import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorkSession';

import intentConfig from '../../lib/intents';
import { startDayExpirationTime, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';
import { utterances } from '../../lib/botResponses';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

	/**
	 * 		IS_BACK ("READY TO WORK" - Peon WC3)
	 */
	
	controller.hears(['is_back'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			// find user then reply
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId],
				include: [ models.SlackUser ]
			})
			.then((user) => {

				var shouldStartNewDay = false;

				// 1. has user started day yet?
				user.getSessionGroups({
					order: `"SessionGroup"."createdAt" DESC`,
					limit: 1
				})
				.then((sessionGroups) => {

					if (sessionGroups.length == 0) {
						shouldStartNewDay = true;
					} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
						shouldStartNewDay = true;
					}

					user.getWorkSessions({
						where: [`"WorkSession"."endTime" > ? `, startDayExpirationTime]
					})
					.then((workSessions) => {

						if (workSessions.length == 0) {
							shouldStartNewDay = true;
						}

						var config = { SlackUserId, shouldStartNewDay };
						controller.trigger(`is_back_flow`, [ bot, config ]);

					});

				});

			});
		}, 1000);
		
	});

	controller.on(`is_back_flow`, (bot, config) => {

		const { SlackUserId, shouldStartNewDay } = config;
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId],
			include: [ models.SlackUser ]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
				var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					convo.isBack = {
						SlackUserId,
						shouldStartNewDay,
						isBackDecision: false // what user wants to do
					}

					var name = user.nickName || user.email;

					// give response based on state user is in
					if (shouldStartNewDay) {
						convo.say(`Welcome back, ${name}!`);
						if (dailyTasks.length > 0) {
							convo.say(`Here are your priorities from our last time together:\n${taskListMessage}`);
						}
						shouldStartNewDayFlow(err, convo);
					} else {
						convo.say(`Welcome back, ${name}!`);
						if (dailyTasks.length > 0) {
							convo.say(`Here are your current priorities: ${taskListMessage}`);
						}
						shouldStartSessionFlow(err, convo);
					}

					convo.on(`end`, (convo) => {

						// cancel all `break` and `work_session` type reminders
						user.getReminders({
							where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break"] ]
						}).
						then((reminders) => {
							reminders.forEach((reminder) => {
								reminder.update({
									"open": false
								})
							});
						})

						const { isBackDecision } = convo;
						var config = { SlackUserId };
						if (convo.status == 'completed') {
							switch (isBackDecision) {
								case intentConfig.START_DAY:
									controller.trigger(`begin_day_flow`, [ bot, config ]);
									break;
								case intentConfig.START_SESSION:
									config.intent = intentConfig.START_SESSION;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.REMINDER:
									controller.trigger(`ask_for_reminder`, [ bot, config ]);
									break;
								case intentConfig.END_DAY:
									config.intent = intentConfig.END_DAY;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.VIEW_TASKS:
									config.intent = intentConfig.VIEW_TASKS;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.ADD_TASK:
									config.intent = intentConfig.ADD_TASK;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
								default:
									break;
							}
						} else {
							bot.reply(message, "Okay! Let me know when you want to start a session or day");
						}
					});
				});

			})
		});

	});

};

// user should start a new day
function shouldStartNewDayFlow(err, convo) {

	convo.ask({
		text: `Ready to make a plan for today? If the above tasks are what you want to work on, we can start a session with those instead :pick:`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "IS_BACK_START_DAY",
				fallback: "You should start a new day",
				actions: [
					{
							name: buttonValues.startDay.name,
							text: "Plan :memo:",
							value: buttonValues.startDay.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.startSession.name,
							text: "Start session",
							value: buttonValues.startSession.value,
							type: "button"
					},
					{
							name: buttonValues.createReminder.name,
							text: "Create reminder",
							value: buttonValues.createReminder.value,
							type: "button"
					},
					{
							name: buttonValues.endDay.name,
							text: "End day",
							value: buttonValues.endDay.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.containsPlan,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.specificYes,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{
			pattern: buttonValues.startSession.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startSession.value
			pattern: utterances.startSession,
			callback: function(response, convo) {
				convo.say(`Let's kick off a new session :soccer:`);
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.createReminder.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.createReminder.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{
			pattern: buttonValues.endDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.endDay.value
			pattern: utterances.containsEnd,
			callback: function(response, convo) {
				convo.say(`It's about that time, isn't it?`);
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

// user should start a session
function shouldStartSessionFlow(err, convo) {

	convo.ask({
		text: `Ready to start another session?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "IS_BACK_START_SESSION",
				fallback: "You should start a new session",
				actions: [
					{
							name: buttonValues.startSession.name,
							text: "Start session :muscle:",
							value: buttonValues.startSession.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.createReminder.name,
							text: "Create reminder",
							value: buttonValues.createReminder.value,
							type: "button"
					},
					{
							name: buttonValues.endDay.name,
							text: "End day",
							value: buttonValues.endDay.value,
							type: "button"
					},
					{
							name: buttonValues.startDay.name,
							text: "Create new Plan",
							value: buttonValues.startDay.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.containsPlan,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{
			pattern: buttonValues.startSession.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startSession.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.createReminder.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.createReminder.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{
			pattern: buttonValues.endDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.endDay.value
			pattern: utterances.containsEnd,
			callback: function(response, convo) {
				convo.say(`It's about that time, isn't it?`);
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}