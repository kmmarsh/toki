import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

import addTaskController from './add';
import completeTasksController from './complete';

// base controller for tasks
export default function(controller) {

	addTaskController(controller);
	completeTasksController(controller);

	/**
	 * 		YOUR DAILY TASKS
	 */
	
	controller.on(`view_daily_tasks_flow`, (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// temporary fix to get tasks
			var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");

			user.getDailyTasks({
				where: [`"DailyTask"."createdAt" > ? AND "DailyTask"."type" = ?`, timeAgoForTasks, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
					var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

					if (dailyTasks.length == 0) {
						convo.say("Looks like you don't have any tasks for today!");
						convo.say("Let me know if you want to `start your day` or `add tasks` to an existing day :memo:");
					} else {
						convo.say("Here are your tasks for today :memo::");
						convo.say(taskListMessage);
					}
          convo.on('end', (convo) => {
          	console.log("\n\n ~ view tasks finished ~ \n\n");
          });
        });

			});

		})

	});

	controller.hears(['daily_tasks'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var channel       = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			controller.trigger(`view_daily_tasks_flow`, [ bot, { SlackUserId } ]);
		}, 1000);

	});

};