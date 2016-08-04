import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, deleteMostRecentDoneSessionMessage } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions, witTimeResponseToTimeZoneObject, prioritizeDailyTasks } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME, sessionTimerDecisions, MINUTES_FOR_DONE_SESSION_TIMEOUT, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';
import { doneSessionAskOptions } from '../modules/endWorkSessionFunctions';

// END OF A WORK SESSION
export default function(controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId      = message.user;
		const doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			if (utterances.containsTaskOrPriority.test(message.text)) {
				// want to finish off some tasks
				controller.trigger(`edit_plan_flow`, [bot, { SlackUserId }]);
			} else {
				controller.trigger(`done_session_flow`, [bot, { SlackUserId, doneSessionEarly }]);
			}
		}, 800);
	});

	/**
	 * 		User has confirmed to ending session
	 * 		This will immediately close the session, then move to
	 * 		specified "post session" options
	 */
	controller.on(`done_session_flow`, (bot, config) => {

		// you can pass in a storedWorkSession
		const { SlackUserId, storedWorkSession, sessionTimerUp, doneSessionEarly } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { SlackUser: { tz }, defaultBreakTime, defaultSnoozeTime } = user;
			const UserId = user.id;

			user.getWorkSessions({
				where: [ `"open" = ?`, true ],
				order: `"WorkSession"."createdAt" DESC`,
				include: [ models.DailyTask ]
			})
			.then((workSessions) => {

				let workSession = storedWorkSession || workSessions[0];

				if (workSession) {

					// WE CLOSE THE WORK SESSION HERE
					// get info about this session
					let now = moment();
					workSession.update({
						open: false,
						endTime: now
					})
					.then((workSession) => {

						let startTime             = moment(workSession.startTime).tz(tz);
						let endTime               = moment(workSession.endTime).tz(tz);
						let endTimeString         = endTime.format("h:mm a");
						let workSessionMinutes    = Math.round(moment.duration(endTime.diff(startTime)).asMinutes());
						let workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);

						workSession.getStoredWorkSession({
							where: [ `"StoredWorkSession"."live" = ?`, true ]
						})
						.then((storedWorkSession) => {

							let dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
								return dailyTask.id;
							});
							
							user.getDailyTasks({
								where: [ `"DailyTask"."id" IN (?)`, dailyTaskIds ],
								include: [ models.Task ]
							})
							.then((dailyTasks) => {

								if (dailyTasks.length > 0) {

									let dailyTask = dailyTasks[0]; // one task per session

									// do our math update to daily task here
									let minutesSpent = dailyTask.minutesSpent;
									minutesSpent += workSessionMinutes;
									dailyTask.update({
										minutesSpent
									})
									.then((dailyTask) => {

										bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

											convo.sessionDone = {
												UserId,
												SlackUserId,
												defaultBreakTime,
												defaultSnoozeTime,
												tz,
												dailyTask,
												doneSessionEarly,
												sessionTimerUp,
												reminders: [],
												currentSession: {
													startTime,
													endTime,
													workSessionMinutes,
													workSessionTimeString,
													dailyTask
												}
											}

											if (storedWorkSession) {
												workSessionMinutes    = storedWorkSession.dataValues.minutes;
												workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);
												// currently paused
												convo.doneSessionEarly.currentSession.isPaused = true;
												convo.doneSessionEarly.currentSession.workSessionTimeString = workSessionTimeString;
											}

											doneSessionAskOptions(convo);


											convo.on('end', (convo) => {

												const { SlackUserId, dailyTask } = convo.sessionDone;

												console.log("\n\n\n session is done!");
												console.log(convo.sessionDone);
												console.log("\n\n\n");

												resumeQueuedReachouts(bot, { SlackUserId });

											})

										});

									});

								}

							});

						});
					})

				} else {

					// want to be end a session when they arent currently in one
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.ask(`You aren't in a session right now! Would you like to start one?`, [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
									convo.startSession = true;
									convo.next();
								}
							},
							{
								pattern: utterances.no,
								callback: (response, convo) => {
									convo.say(`Okay! I'll be here when you're ready to crank again :wrench: `);
									convo.next();
								}
							},
							{
								default: true,
								callback: (response, convo) => {
									convo.say("Sorry, I didn't get that. Please tell me `yes` or `no` to the question!");
									convo.repeat();
									convo.next();
								}
							}
						]);
						convo.next();
						convo.on('end', (convo) => {
							if (convo.startSession) {
								controller.trigger('begin_session', [bot, { SlackUserId }]);
							} else {
								resumeQueuedReachouts(bot, { SlackUserId });
							}
						});
					});

				}

			});

		});

	});

	/**
	 * 			~~ SESSION_TIMER FUNCTIONALITIES ~~
	 */
	
	// session timer triggered by cron-job
	controller.on('session_timer_up', (bot, config) => {

		const { SlackUserId, workSession } = config;
		const sessionTimerUp   = true;
		const doneSessionEarly = false;

		let dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
			return dailyTask.id;
		});

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;

			const { SlackUser: { tz }, defaultSnoozeTime, defaultBreakTime } = user;
			let startTime             = moment(workSession.startTime).tz(tz);
			let endTime               = moment(workSession.endTime).tz(tz);
			let endTimeString         = endTime.format("h:mm a");
			let workSessionMinutes    = Math.round(moment.duration(endTime.diff(startTime)).asMinutes());
			let workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);

			user.getDailyTasks({
				where: [ `"DailyTask"."id" IN (?) AND "Task"."done" = ?`, dailyTaskIds, false ],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				if (dailyTasks.length > 0) {

					// cancel all old reminders
					user.getReminders({
						where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break", "done_session_snooze"] ]
					}).
					then((oldReminders) => {
						oldReminders.forEach((reminder) => {
							reminder.update({
								"open": false
							})
						});
					});

					let dailyTask = dailyTasks[0]; // one task per session

					// do our math update to daily task here
					let minutesSpent = dailyTask.minutesSpent;
					minutesSpent += workSessionMinutes;
					dailyTask.update({
						minutesSpent
					})
					.then((dailyTask) => {

						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

							convo.sessionDone = {
								UserId,
								SlackUserId,
								defaultBreakTime,
								defaultSnoozeTime,
								tz,
								dailyTask,
								sessionTimerUp,
								doneSessionEarly,
								reminders: [],
								currentSession: {
									startTime,
									endTime,
									workSessionMinutes,
									workSessionTimeString,
									dailyTask
								}
							}

							doneSessionAskOptions(convo);


							convo.on('end', (convo) => {

								const { SlackUserId, dailyTask } = convo.sessionDone;

								console.log("\n\n\n session is done!");
								console.log(convo.sessionDone);
								console.log("\n\n\n");

							})

						});

					});
				}
			});
		})
	});

}



