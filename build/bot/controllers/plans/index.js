'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * Starting a new plan for the day
 */

// base controller for new plan


exports.default = function (controller) {

	controller.hears(['start_day'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('new_plan_flow', [bot, { SlackUserId: SlackUserId }]);
		}, 1000);
	});

	controller.hears(['daily_tasks', 'add_daily_task', 'completed_task'], 'direct_message', _index.wit.hears, function (bot, message) {
		var text = message.text;
		var channel = message.channel;

		var SlackUserId = message.user;

		var config = { SlackUserId: SlackUserId, message: message };

		// wit may pick up "add check in" as add_daily_task
		if (_botResponses.utterances.startsWithAdd.test(text) && _botResponses.utterances.containsCheckin.test(text)) {
			if (_botResponses.utterances.containsOnlyCheckin.test(text)) {
				config.reminder_type = "work_session";
			}
			controller.trigger('ask_for_reminder', [bot, config]);
			return;
		};

		controller.trigger('plan_command_center', [bot, config]);
	});

	/**
 * 	~ NEW PLAN FOR YOUR DAY ~
 * 	1) get your 3 priorities
 * 	2) make it easy to prioritize in order for the day
 * 	3) enter work sessions for each of them
 */

	controller.on('new_plan_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			var daySplit = (0, _miscHelpers.getCurrentDaySplit)(tz);

			user.getSessionGroups({
				where: ['"SessionGroup"."type" = ? AND "SessionGroup"."createdAt" > ?', "start_work", _constants.dateOfNewPlanDayFlow],
				limit: 1
			}).then(function (sessionGroups) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					var name = user.nickName || user.email;
					convo.name = name;

					convo.newPlan = {
						SlackUserId: SlackUserId,
						tz: tz,
						daySplit: daySplit,
						onboardVersion: false,
						prioritizedTasks: [],
						startTask: {
							index: 0, // fail-safe default. should get updated in flow
							minutes: 30 // fail-safe default. should get updated in flow
						},
						startTime: false, // default will be now
						includeSlackUserIds: []
					};

					var day = (0, _momentTimezone2.default)().tz(tz).format('dddd');

					if (sessionGroups.length == 0) {
						convo.newPlan.onboardVersion = true;
					}

					if (!convo.newPlan.onboardVersion) {
						convo.say('Happy ' + day + ', ' + name + '! Let\'s win the ' + daySplit + ' :muscle:');
					}

					(0, _plan.startNewPlanFlow)(convo);

					// on finish conversation
					convo.on('end', function (convo) {
						var newPlan = convo.newPlan;
						var exitEarly = newPlan.exitEarly;
						var prioritizedTasks = newPlan.prioritizedTasks;
						var startTask = newPlan.startTask;
						var startTime = newPlan.startTime;
						var includeSlackUserIds = newPlan.includeSlackUserIds;


						(0, _miscHelpers.closeOldRemindersAndSessions)(user);

						// save startTask information
						startTask.taskObject = _extends({}, prioritizedTasks[startTask.index], {
							minutes: startTask.minutes
						});
						prioritizedTasks[startTask.index] = startTask.taskObject;

						if (exitEarly) {
							return;
						}

						// create plan
						_models2.default.SessionGroup.create({
							type: "start_work",
							UserId: UserId
						}).then(function (sessionGroup) {

							// then, create the 3 priorities for today
							user.getDailyTasks({
								where: ['"DailyTask"."type" = ?', "live"]
							}).then(function (dailyTasks) {
								var dailyTaskIds = dailyTasks.map(function (dailyTask) {
									return dailyTask.id;
								});
								if (dailyTaskIds.length == 0) {
									dailyTaskIds = [0];
								};
								_models2.default.DailyTask.update({
									type: "archived"
								}, {
									where: ['"DailyTasks"."id" IN (?)', dailyTaskIds]
								}).then(function (dailyTasks) {
									prioritizedTasks.forEach(function (task, index) {
										var priority = index + 1;
										var text = task.text;
										var minutes = task.minutes;

										_models2.default.Task.create({
											text: text
										}).then(function (task) {
											task.createDailyTask({
												minutes: minutes,
												priority: priority,
												UserId: UserId
											}).then(function (dailyTask) {
												var DailyTaskId = dailyTask.id;

												if (index == startTask.index) {
													if (startTime) {
														// if you asked for a queued reminder
														_models2.default.Reminder.create({
															UserId: UserId,
															remindTime: startTime,
															type: "start_work",
															DailyTaskId: DailyTaskId
														});
													}
												}
											});
										});
									});
								});
							});

							// include who you want to include in your list
							if (includeSlackUserIds) {
								includeSlackUserIds.forEach(function (IncludedSlackUserId) {
									_models2.default.Include.create({
										IncluderSlackUserId: SlackUserId,
										IncludedSlackUserId: IncludedSlackUserId
									});
								});
							}
						});

						console.log("here is new plan object:\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						setTimeout(function () {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}, 1250);

						// placeholder for keep going
						if (newPlan) {} else {
							// default premature end
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
								convo.say("Okay! Let me know when you want to plan for today");
								convo.next();
							});
						}
					});
				});
			});
		});
	});

	/**
  * 	~ PLAN COMMAND CENTER ~
  * 	You enter this plan command center
  * 	Can have preset options that will handle the plan accordingly:
  * 		1) "do" a task
  * 		2) "add" tasks
  * 		3) "complete" tasks
  * 		4) "delete" tasks
  */

	controller.on('plan_command_center', function (bot, config) {

		console.log("\n\n\n ~~ In Plan Command Center ~~ \n\n\n");

		var message = config.message;
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var planDecision = config.planDecision;


		var text = message ? message.text : '';
		var channel = message ? message.channel : false;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = bots[botToken];
		}

		var taskNumbers = (0, _messageHelpers.convertStringToNumbersArray)(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
		}

		// if not triggered with a pre-defined planDecision,
		// parse text to try and figure it out
		if (!planDecision) {
			// this is how you make switch/case statements with RegEx
			switch (text) {
				case (text.match(_constants.constants.PLAN_DECISION.complete.reg_exp) || {}).input:
					// complete task
					config.planDecision = _constants.constants.PLAN_DECISION.complete.word;
					break;
				case (text.match(_constants.constants.PLAN_DECISION.add.reg_exp) || {}).input:
					// add task
					config.planDecision = _constants.constants.PLAN_DECISION.add.word;
					break;
				case (text.match(_constants.constants.PLAN_DECISION.view.reg_exp) || {}).input:
					// view plan
					config.planDecision = _constants.constants.PLAN_DECISION.view.word;
					break;
				case (text.match(_constants.constants.PLAN_DECISION.delete.reg_exp) || {}).input:
					// delete plans
					config.planDecision = _constants.constants.PLAN_DECISION.delete.word;
					break;
				case (text.match(_constants.constants.PLAN_DECISION.edit.reg_exp) || {}).input:
					// edit plan
					config.planDecision = _constants.constants.PLAN_DECISION.edit.word;
					break;
				case (text.match(_constants.constants.PLAN_DECISION.work.reg_exp) || {}).input:
					// do plan
					config.planDecision = _constants.constants.PLAN_DECISION.work.word;
					break;
				default:
					config.planDecision = config.taskNumbers ? _constants.constants.PLAN_DECISION.work.word : _constants.constants.PLAN_DECISION.view.word;
					break;
			}
		}

		if (channel) {
			bot.send({
				type: "typing",
				channel: channel
			});
		}
		setTimeout(function () {
			controller.trigger('edit_plan_flow', [bot, config]);
		}, 500);
	});

	/**
  * 		WHERE YOU ACTUALLY CARRY OUT THE ACTION FOR THE PLAN
  */
	controller.on('edit_plan_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var taskNumbers = config.taskNumbers;
		var planDecision = config.planDecision;
		var message = config.message;
		var botCallback = config.botCallback;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			user.getWorkSessions({
				where: ['"open" = ?', true]
			}).then(function (workSessions) {

				var openWorkSession = false;
				if (workSessions.length > 0) {
					openWorkSession = workSessions[0];
				}

				user.getDailyTasks({
					where: ['"DailyTask"."type" = ?', "live"],
					include: [_models2.default.Task],
					order: '"Task"."done", "DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

						convo.planEdit = {
							bot: bot,
							tz: tz,
							SlackUserId: SlackUserId,
							dailyTasks: dailyTasks,
							updateTaskListMessageObject: {},
							newTasks: [],
							dailyTaskIdsToDelete: [],
							dailyTaskIdsToComplete: [],
							dailyTasksToUpdate: [], // existing dailyTasks
							openWorkSession: openWorkSession,
							planDecision: planDecision,
							taskNumbers: taskNumbers,
							changePlanCommand: {
								decision: false
							}
						};

						// if you are changing between commands, we will
						// store that information and have special config ability
						if (config.changePlanCommand && config.changePlanCommand.decision) {
							convo.planEdit.changedPlanCommands = true;
						}

						// this is the flow you expect for editing tasks
						(0, _editPlanFunctions.startEditPlanConversation)(convo);

						convo.on('end', function (convo) {
							var _convo$planEdit = convo.planEdit;
							var newTasks = _convo$planEdit.newTasks;
							var dailyTasks = _convo$planEdit.dailyTasks;
							var SlackUserId = _convo$planEdit.SlackUserId;
							var dailyTaskIdsToDelete = _convo$planEdit.dailyTaskIdsToDelete;
							var dailyTaskIdsToComplete = _convo$planEdit.dailyTaskIdsToComplete;
							var dailyTasksToUpdate = _convo$planEdit.dailyTasksToUpdate;
							var startSession = _convo$planEdit.startSession;
							var dailyTasksToWorkOn = _convo$planEdit.dailyTasksToWorkOn;
							var changePlanCommand = _convo$planEdit.changePlanCommand;


							console.log("\n\n\n at end of convo planEdit");
							console.log(convo.planEdit);

							// this means we are changing the plan!
							if (changePlanCommand.decision) {
								var _message = { text: changePlanCommand.text };
								var _config = { SlackUserId: SlackUserId, message: _message, changePlanCommand: changePlanCommand };
								controller.trigger('plan_command_center', [bot, _config]);
								return;
							}

							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });

							if (startSession && dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {

								var _config2 = {
									SlackUserId: SlackUserId,
									dailyTaskToWorkOn: dailyTasksToWorkOn[0]
								};
								var _bot = convo.planEdit.bot;
								controller.trigger('begin_session', [_bot, _config2]);
								return;
							}

							/*
       // add new tasks if they got added
       if (newTasks.length > 0) {
       	var priority = dailyTasks.length;
       	// add the priorities
       	newTasks = newTasks.map((newTask) => {
       		priority++;
       		return {
       			...newTask,
       			priority
       		};
       	});
       		newTasks.forEach((newTask) => {
       		const { minutes, text, priority } = newTask;
       		if (minutes && text) {
       			models.Task.create({
       				text
       			})
       			.then((task) => {
       				const TaskId = task.id;
       				models.DailyTask.create({
       					TaskId,
       					priority,
       					minutes,
       					UserId
       				});
       			});
       		}
       	})
       }
       	// delete tasks if requested
       if (dailyTaskIdsToDelete.length > 0) {
       	models.DailyTask.update({
       		type: "deleted"
       	}, {
       		where: [`"DailyTasks"."id" in (?)`, dailyTaskIdsToDelete]
       	})
       }
       	// complete tasks if requested
       if (dailyTaskIdsToComplete.length > 0) {
       	models.DailyTask.findAll({
       		where: [`"DailyTask"."id" in (?)`, dailyTaskIdsToComplete],
       		include: [models.Task]
       	})
       	.then((dailyTasks) => {
       			var completedTaskIds = dailyTasks.map((dailyTask) => {
       			return dailyTask.TaskId;
       		});
       			models.Task.update({
       			done: true
       		}, {
       			where: [`"Tasks"."id" in (?)`, completedTaskIds]
       		})
       	})
       }
       	// update daily tasks if requested
       if (dailyTasksToUpdate.length > 0) {
       	dailyTasksToUpdate.forEach((dailyTask) => {
       		if (dailyTask.dataValues && dailyTask.minutes && dailyTask.text) {
       			const { minutes, text } = dailyTask;
       			models.DailyTask.update({
       				text,
       				minutes
       			}, {
       				where: [`"DailyTasks"."id" = ?`, dailyTask.dataValues.id]
       			})
       		}
       	})
       }
       	setTimeout(() => {
       		setTimeout(() => {
       		prioritizeDailyTasks(user);
       	}, 1000);
       		// only check for live tasks if SOME action took place
       	if (newTasks.length > 0 || dailyTaskIdsToDelete.length > 0 || dailyTaskIdsToComplete.length > 0 || dailyTasksToUpdate.length > 0) {
       		checkWorkSessionForLiveTasks({ SlackUserId, bot, controller });
       	}
       }, 750);
       */
						});
					});
				});
			});
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _constants = require('../../lib/constants');

var _plan = require('../modules/plan');

var _editPlanFunctions = require('./editPlanFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map