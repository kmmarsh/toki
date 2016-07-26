'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEditTaskListMessage = startEditTaskListMessage;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this one shows the task list message and asks for options
function startEditTaskListMessage(convo) {
	var _convo$tasksEdit = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit.dailyTasks;
	var bot = _convo$tasksEdit.bot;
	var openWorkSession = _convo$tasksEdit.openWorkSession;
	var taskNumbers = _convo$tasksEdit.taskNumbers;
	var taskDecision = _convo$tasksEdit.taskDecision;

	/**
  * 		We enter here to provide specific context if the user
  * 		has an currently open work session or not. Otherwise,
  * 		the next step is the same (`specificCommandFlow`)
  */

	if (openWorkSession) {
		openWorkSession.getStoredWorkSession({
			where: ['"StoredWorkSession"."live" = ?', true]
		}).then(function (storedWorkSession) {
			openWorkSession.getDailyTasks({
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				var now = (0, _moment2.default)();
				var endTime = (0, _moment2.default)(openWorkSession.endTime);
				var endTimeString = endTime.format("h:mm a");
				var minutes = Math.round(_moment2.default.duration(endTime.diff(now)).asMinutes());
				var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

				var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
					return dailyTask.dataValues.Task.text;
				});

				var sessionTasks = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);

				convo.tasksEdit.currentSession = {
					minutes: minutes,
					minutesString: minutesString,
					sessionTasks: sessionTasks,
					endTimeString: endTimeString,
					storedWorkSession: storedWorkSession
				};

				if (storedWorkSession) {
					convo.tasksEdit.currentSession.isPaused = true;
				}

				/**
     * 		~~ Start of flow for specific command ~~
     * 				* if you have an openWorkSession *
     */

				specificCommandFlow(convo);
				convo.next();
			});
		});
	} else {

		/**
   * 		~~ Start of flow for specific command ~~
   * 		 * if you don't have openWorkSession *
   */

		specificCommandFlow(convo);
		convo.next();
	}
}

/**
 * 		ENTRY POINT FOR VIEW / EDIT PLAN
 */
function specificCommandFlow(convo) {
	var _convo$tasksEdit2 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit2.dailyTasks;
	var bot = _convo$tasksEdit2.bot;
	var openWorkSession = _convo$tasksEdit2.openWorkSession;
	var taskNumbers = _convo$tasksEdit2.taskNumbers;
	var taskDecision = _convo$tasksEdit2.taskDecision;
	var currentSession = _convo$tasksEdit2.currentSession;


	switch (taskDecision) {
		case _constants.TASK_DECISION.complete.word:
			console.log('\n\n ~~ user wants to complete tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
				var options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
			} else {
				completeTasksFlow(convo);
			}
			break;
		case _constants.TASK_DECISION.add.word:
			console.log('\n\n ~~ user wants to add tasks in specificCommandFlow ~~ \n\n');
			addTasksFlow(convo);
			break;
		case _constants.TASK_DECISION.view.word:
			console.log('\n\n ~~ user wants to view tasks in specificCommandFlow ~~ \n\n');
			sayTasksForToday(convo);
			break;
		case _constants.TASK_DECISION.delete.word:
			console.log('\n\n ~~ user wants to delete tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToDeleteArray) {
				// single line complete ability
				singleLineDeleteTask(convo, taskNumbersToDeleteArray);
				var _options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, _options);
			} else {
				deleteTasksFlow(convo);
			}
			break;
		case _constants.TASK_DECISION.edit.word:
			console.log('\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n');
			break;
		case _constants.TASK_DECISION.work.word:

			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);

			if (taskNumbersToWorkOnArray) {
				// single line work ability
				singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
			} else {
				workOnTasksFlow(convo);
			}
			break;
		default:
			break;
	}

	// sayWorkSessionMessage(convo);

	// if (remainingTasks.length == 0) {
	// 	askForTaskListOptionsIfNoRemainingTasks(convo);
	// }

	convo.next();
}

function sayWorkSessionMessage(convo) {
	var _convo$tasksEdit3 = convo.tasksEdit;
	var openWorkSession = _convo$tasksEdit3.openWorkSession;
	var currentSession = _convo$tasksEdit3.currentSession;


	var workSessionMessage = '';
	if (openWorkSession && currentSession) {
		var minutes = currentSession.minutes;
		var minutesString = currentSession.minutesString;
		var sessionTasks = currentSession.sessionTasks;
		var endTimeString = currentSession.endTimeString;
		var storedWorkSession = currentSession.storedWorkSession;

		if (storedWorkSession) {
			// currently paused
			minutes = storedWorkSession.dataValues.minutes;
			minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
			workSessionMessage = 'Your session is still paused :double_vertical_bar: You have *' + minutesString + '* remaining for ' + sessionTasks;
		} else {
			// currently live
			workSessionMessage = 'You\'re currently in a session for ' + sessionTasks + ' until *' + endTimeString + '* (' + minutesString + ' left)';
		}
		convo.say(workSessionMessage);
	}
}

function sayTasksForToday(convo) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
	var dailyTasks = convo.tasksEdit.dailyTasks;


	options.segmentCompleted = true;
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	var taskMessage = "Here are your tasks for today :memo::";
	if (options.onlyRemainingTasks) {
		taskMessage = "Here are your remaining tasks for today :memo::";
	}
	convo.say(taskMessage);
	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});
}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {
	var _convo$tasksEdit4 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit4.dailyTasks;
	var dailyTaskIdsToComplete = _convo$tasksEdit4.dailyTaskIdsToComplete;

	var dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var priority = dailyTask.dataValues.priority;

		var stillNotCompleted = true;
		if (taskNumbersToCompleteArray.indexOf(priority) > -1) {
			dailyTasksToComplete.push(dailyTask);
			stillNotCompleted = false;
		}
		return stillNotCompleted;
	});

	var priority = 1;
	dailyTasks = dailyTasks.map(function (dailyTask) {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToComplete.length > 0) {
		var dailyTaskTextsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToCompleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToComplete);

		convo.say('Great work :punch: I checked off ' + dailyTasksToCompleteString + '!');

		// add to complete array for tasksEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;
	} else {
		convo.say('Ah, I didn\'t find that task to complete');
	}

	convo.next();
}

function completeTasksFlow(convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	// say task list, then ask which ones to complete

	sayTasksForToday(convo);

	var message = 'Which of your task(s) above would you like to complete?';
	convo.ask(message, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to complete tasks! :wave: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumbersToCompleteArray) {
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
				var options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
			} else {
				convo.say("Oops, I don't totally understand :dog:. Let's try this again");
				convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
				convo.repeat();
			}
			convo.next();
		}
	}]);

	convo.next();
}

/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {
	var _convo$tasksEdit5 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit5.dailyTasks;
	var dailyTaskIdsToDelete = _convo$tasksEdit5.dailyTaskIdsToDelete;

	var dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var priority = dailyTask.dataValues.priority;

		var stillNotDeleted = true;
		if (taskNumbersToDeleteArray.indexOf(priority) > -1) {
			dailyTasksToDelete.push(dailyTask);
			stillNotDeleted = false;
		}
		return stillNotDeleted;
	});

	var priority = 1;
	dailyTasks = dailyTasks.map(function (dailyTask) {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToDelete.length > 0) {
		var dailyTasksTextsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToDeleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTasksTextsToDelete);

		convo.say('Sounds good, I deleted ' + dailyTasksToDeleteString + '!');

		// add to delete array for tasksEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;
	} else {
		convo.say('Ah, I didn\'t find that task to delete');
	}

	convo.next();
}

function deleteTasksFlow(convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	// say task list, then ask which ones to complete

	sayTasksForToday(convo);

	var message = 'Which of your task(s) above would you like to delete?';
	convo.ask(message, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to delete tasks! :wave: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumbersToDeleteArray) {
				singleLineDeleteTask(convo, taskNumbersToDeleteArray);
				var options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
			} else {
				convo.say("Oops, I don't totally understand :dog:. Let's try this again");
				convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
				convo.repeat();
			}
			convo.next();
		}
	}]);

	convo.next();
}

/**
 * 		~~ ADD TASKS ~~
 */

function addTasksFlow(convo) {
	var source_message = convo.source_message;
	var _convo$tasksEdit6 = convo.tasksEdit;
	var bot = _convo$tasksEdit6.bot;
	var dailyTasks = _convo$tasksEdit6.dailyTasks;
	var newTasks = _convo$tasksEdit6.newTasks;
	var actuallyWantToAddATask = _convo$tasksEdit6.actuallyWantToAddATask;

	// say task list, then ask for user to add tasks

	var options = { onlyRemainingTasks: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	var tasksToAdd = [];
	convo.say("Let's do it! What other tasks do you want to work on?");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	}, [{
		pattern: _constants.buttonValues.doneAddingTasks.value,
		callback: function callback(response, convo) {
			saveNewTaskResponses(tasksToAdd, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.done,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Excellent!");
			saveNewTaskResponses(tasksToAdd, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay! Let me know whenever you want to add more tasks");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			tasksToAdd.push(newTask);
			var taskArray = [];
			newTasks.forEach(function (task) {
				taskArray.push(task);
			});
			tasksToAdd.forEach(function (task) {
				taskArray.push(task);
			});

			options = { onlyRemainingTasks: true };
			if (actuallyWantToAddATask) {
				options.dontCalculateMinutes = true;
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
			} else {
				options.segmentCompleted = true;
				options.newTasks = taskArray;
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);
			}

			if (updateTaskListMessageObject) {
				updateTaskListMessageObject.text = taskListMessage;
				updateTaskListMessageObject.attachments = JSON.stringify(_constants.taskListMessageDoneButtonAttachment);

				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);

	convo.next();
}

function getTimeToTasks(response, convo) {
	var _convo$tasksEdit7 = convo.tasksEdit;
	var bot = _convo$tasksEdit7.bot;
	var dailyTasks = _convo$tasksEdit7.dailyTasks;
	var newTasks = _convo$tasksEdit7.newTasks;
	var tz = _convo$tasksEdit7.tz;

	var options = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };

	var taskArray = dailyTasks;
	var taskArrayType = "update";
	if (newTasks && newTasks.length > 0) {
		taskArrayType = "new";
		taskArray = newTasks;
	}

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var timeToTasksArray = [];

	var mainText = "Let's add time to each of your tasks:";
	var taskTextsArray = taskArray.map(function (task) {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return task.text;
	});
	var attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

	convo.ask({
		text: mainText,
		attachments: attachments
	}, [{
		pattern: _constants.buttonValues.actuallyWantToAddATask.value,
		callback: function callback(response, convo) {
			convo.tasksEdit.actuallyWantToAddATask = true;
			addTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.resetTimes.value,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

				timeToTasksArray.pop();
				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				var _options2 = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, _options2);

				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		pattern: _botResponses.utterances.containsResetOrUndo,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

				timeToTasksArray.pop();
				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var _response$intentObjec = response.intentObject.entities;
			var reminder = _response$intentObjec.reminder;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;


			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			if (updateTaskListMessageObject) {

				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
				var commaOrNewLine = new RegExp(/[,\n]/);
				var timeToTasks = response.text.split(commaOrNewLine);

				// get user string response and convert it to time!
				if (timeToTasks.length > 1) {
					// entered via comma or \n (30 min, 45 min) and requires old method
					timeToTasks.forEach(function (time) {
						var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						if (minutes > 0) timeToTasksArray.push(minutes);
					});
				} else {
					// user entered only one time (1 hr 35 min) and we can use wit intelligence
					// now that we ask one at a time, we can use wit duration
					var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
					if (customTimeObject) {
						var minutes;
						if (duration) {
							minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
						} else {
							// cant currently handle datetime cuz wit sucks
							minutes = (0, _messageHelpers.convertTimeStringToMinutes)(response.text);
							// this should be done through datetime, but only duration for now
							// minutes = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());
						}
					} else {
						minutes = (0, _messageHelpers.convertTimeStringToMinutes)(response.text);
					}

					if (minutes > 0) timeToTasksArray.push(minutes);
				}

				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				// update message for the user
				options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);

				if (timeToTasksArray.length >= taskArray.length) {
					if (taskArrayType = "new") {
						convo.tasksEdit.newTasks = taskArray;
					} else if (taskArrayType = "update") {
						convo.tasksEdit.dailyTasksToUpdate = taskArray;
					}
					confirmTimeToTasks(convo);
					convo.next();
				}
			}
		}
	}]);
}

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {
	var _convo$tasksEdit8 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit8.dailyTasks;
	var dailyTasksToUpdate = _convo$tasksEdit8.dailyTasksToUpdate;
	var newTasks = _convo$tasksEdit8.newTasks;


	convo.ask("Are those times right?", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
			if (newTasks.length > 0) {
				// you added new tasks and are confirming time for them
				addNewTasksToTaskList(response, convo);
			} else if (dailyTasksToUpdate.length > 0) {
				// editing time to tasks
				var options = { dontUseDataValues: true, segmentCompleted: true };
				var fullTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasksToUpdate, options);

				convo.say("Here's your remaining task list :memo::");
				convo.say(fullTaskListMessage);
			}

			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {

			convo.say("Let's give this another try :repeat_one:");
			convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");

			if (newTasks.length > 0) {
				getTimeToTasks(response, convo);
			} else if (dailyTasksToUpdate.length > 0) {
				editTaskTimesFlow(response, convo);
			}

			convo.next();
		}
	}]);
}

function addNewTasksToTaskList(response, convo) {
	// combine the newTasks with dailyTasks
	var _convo$tasksEdit9 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit9.dailyTasks;
	var newTasks = _convo$tasksEdit9.newTasks;

	var options = { segmentCompleted: true };

	var taskArray = [];
	dailyTasks.forEach(function (task) {
		taskArray.push(task);
	});
	newTasks.forEach(function (newTask) {
		taskArray.push(newTask);
	});

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	convo.say("Here's your updated task list :memo::");
	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});
	convo.next();
}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	var dailyTasksToWorkOn = [];

	dailyTasks.forEach(function (dailyTask, index) {
		var priority = dailyTask.dataValues.priority;

		if (taskNumbersToWorkOnArray.indexOf(priority) > -1) {
			dailyTasksToWorkOn.push(dailyTask);
		}
	});

	if (dailyTasksToWorkOn.length > 0) {

		var taskTextsToWorkOnArray = dailyTasksToWorkOn.map(function (dailyTask) {
			var text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
			return text;
		});

		convo.tasksEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;

		var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

		convo.say('Let\'s do it! :muscle:');
		convo.tasksEdit.startSession = true;
		convo.next();
	} else {
		convo.say('Ah, I didn\'t find that task to work on');
	}

	convo.next();
}

// work on which task flow
function workOnTasksFlow(convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	// say task list, then ask which ones to complete

	sayTasksForToday(convo);

	var message = 'Which of your task(s) above would you like to work on?';
	convo.ask(message, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to work on a task :muscle: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumbersToWorkOnArray) {
				singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
			} else {
				convo.say("Oops, I don't totally understand :dog:. Let's try this again");
				convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
				convo.repeat();
			}
			convo.next();
		}
	}]);

	convo.next();
}

/**
 * 			DEPRECATED FUNCTIONS 7/25/16
 */

// options to ask if user has at least 1 remaining task
function askForTaskListOptions(convo) {
	var _convo$tasksEdit10 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit10.dailyTasks;
	var bot = _convo$tasksEdit10.bot;

	// see if remaining tasks or not

	var remainingTasks = [];
	dailyTasks.forEach(function (dailyTask) {
		if (!dailyTask.dataValues.Task.done) {
			remainingTasks.push(dailyTask);
		}
	});

	if (remainingTasks.length == 0) {
		askForTaskListOptionsIfNoRemainingTasks(convo);
		return;
	}

	convo.ask({
		text: 'What would you like to do? `i.e. complete tasks 1 and 2`',
		attachments: [{
			attachment_type: 'default',
			callback_id: "EDIT_TASKS",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "How do you want to edit tasks?",
			actions: [{
				name: _constants.buttonValues.addTasks.name,
				text: "Add tasks",
				value: _constants.buttonValues.addTasks.value,
				type: "button"
			}, {
				name: _constants.buttonValues.markComplete.name,
				text: "Complete :heavy_check_mark:",
				value: _constants.buttonValues.markComplete.value,
				type: "button"
			}, {
				name: _constants.buttonValues.editTaskTimes.name,
				text: "Edit times",
				value: _constants.buttonValues.editTaskTimes.value,
				type: "button"
			}, {
				name: _constants.buttonValues.deleteTasks.name,
				text: "Remove tasks",
				value: _constants.buttonValues.deleteTasks.value,
				type: "button",
				style: "danger"
			}, {
				name: _constants.buttonValues.neverMindTasks.name,
				text: "Nothing!",
				value: _constants.buttonValues.neverMindTasks.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.addTasks.value,
		callback: function callback(response, convo) {
			addTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addTasks.value
		pattern: _botResponses.utterances.containsAdd,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay, let's add some tasks :muscle:");
			addTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.markComplete.value,
		callback: function callback(response, convo) {
			completeTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.markComplete.value
		pattern: _botResponses.utterances.containsCompleteOrCheckOrCross,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var dailyTasks = convo.tasksEdit.dailyTasks;

			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				confirmCompleteTasks(response, convo);
			} else {
				completeTasksFlow(response, convo);
			}

			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.deleteTasks.value,
		callback: function callback(response, convo) {
			deleteTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.deleteTasks.value
		pattern: _botResponses.utterances.containsDeleteOrRemove,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var dailyTasks = convo.tasksEdit.dailyTasks;

			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				confirmDeleteTasks(response, convo);
			} else {
				deleteTasksFlow(response, convo);
			}

			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.editTaskTimes.value,
		callback: function callback(response, convo) {
			editTaskTimesFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.editTaskTimes.value
		pattern: _botResponses.utterances.containsTime,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Let's do this :hourglass:");
			editTaskTimesFlow(response, convo);
			convo.next();
		}
	}, { // if user lists tasks, we can infer user wants to start a specific session
		pattern: _botResponses.utterances.containsNumber,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var tasksToWorkOnString = response.text;
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToWorkOnString, dailyTasks);

			if (!taskNumbersToWorkOnArray) {
				convo.say("You didn't pick a valid task to work on :thinking_face:");
				convo.say("You can pick a task from your list `i.e. tasks 1, 3` to work on");
				askForTaskListOptions(response, convo);
				return;
			}

			var dailyTasksToWorkOn = [];
			dailyTasks.forEach(function (dailyTask, index) {
				var taskNumber = index + 1; // b/c index is 0-based
				if (taskNumbersToWorkOnArray.indexOf(taskNumber) > -1) {
					dailyTasksToWorkOn.push(dailyTask);
				}
			});

			convo.tasksEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;
			confirmWorkSession(convo);

			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMindTasks.value,
		callback: function callback(response, convo) {
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var currentSession = convo.tasksEdit.currentSession;


			convo.say("Okay! No worries :smile_cat:");

			if (currentSession) {
				var minutesString = currentSession.minutesString;
				var sessionTasks = currentSession.sessionTasks;
				var endTimeString = currentSession.endTimeString;


				if (currentSession.isPaused) {
					// paused session
					convo.say({
						text: 'Let me know when you want to resume your session for ' + sessionTasks + '!',
						attachments: _constants.pausedSessionOptionsAttachments
					});
				} else {
					// live session
					convo.say({
						text: 'Good luck with ' + sessionTasks + '! See you at *' + endTimeString + '* :timer_clock:',
						attachments: _constants.startSessionOptionsAttachments
					});
				}
			}

			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// options to ask if user has no remaining tasks
function askForTaskListOptionsIfNoRemainingTasks(convo) {
	var bot = convo.tasksEdit.bot;


	convo.ask({
		text: 'You have no remaining tasks for today. Would you like to add some tasks?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "ADD_TASKS",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "Let's add some tasks?",
			actions: [{
				name: _constants.buttonValues.addTasks.name,
				text: "Add tasks",
				value: _constants.buttonValues.addTasks.value,
				type: "button"
			}, {
				name: _constants.buttonValues.neverMindTasks.name,
				text: "Good for now!",
				value: _constants.buttonValues.neverMindTasks.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.addTasks.value,
		callback: function callback(response, convo) {
			addTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addTasks.value
		pattern: _botResponses.utterances.containsAdd,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay, let's add some tasks :muscle:");
			addTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addTasks.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay, let's add some tasks :muscle:");
			addTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMindTasks.value,
		callback: function callback(response, convo) {
			convo.say("Let me know whenever you're ready to `add tasks`");
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMindTasks.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! I didn't add any :smile_cat:");
			convo.say("Let me know whenever you're ready to `add tasks`");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

function saveNewTaskResponses(tasksToAdd, convo) {

	// get the newTasks!
	var _convo$tasksEdit11 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit11.dailyTasks;
	var newTasks = _convo$tasksEdit11.newTasks;


	if (tasksToAdd) {

		// only get the new tasks
		var tasksArray = [];
		tasksToAdd.forEach(function (task) {
			if (task.newTask) {
				tasksArray.push(task);
			}
		});
		var tasksToAddArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(tasksArray);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		tasksToAddArray.forEach(function (newTask) {
			newTasks.push(newTask);
		});

		convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.tasksEdit.newTasks = newTasks; // only the new ones
	}

	convo.next();
}

/**
 * 			~~ EDIT TIMES TO TASKS FLOW ~~
 */

function editTaskTimesFlow(response, convo) {
	var _convo$tasksEdit12 = convo.tasksEdit;
	var bot = _convo$tasksEdit12.bot;
	var dailyTasks = _convo$tasksEdit12.dailyTasks;
	var dailyTasksToUpdate = _convo$tasksEdit12.dailyTasksToUpdate;


	var dailyTasksToSetMinutes = [];
	// for all the remaining daily tasks
	dailyTasks.forEach(function (dailyTask) {
		if (dailyTask.dataValues && !dailyTask.dataValues.Task.done) {
			dailyTasksToSetMinutes.push(dailyTask);
		}
	});

	convo.tasksEdit.dailyTasksToSetMinutes = dailyTasksToSetMinutes;

	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasksToSetMinutes, options);
	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});

	getTimeToTasks(response, convo);
}

function getRemainingTasks(fullTaskArray, newTasks) {
	var remainingTasks = [];
	fullTaskArray.forEach(function (task) {
		if (task.dataValues) {
			task = task.dataValues;
		};
		if (!task.done && task.type == 'live') {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach(function (newTask) {
			remainingTasks.push(newTask);
		});
	}
	return remainingTasks;
}
//# sourceMappingURL=editTaskListFunctions.js.map