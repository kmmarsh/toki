import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

import startDayFlowController from './startDayFlow';

const FINISH_WORD = 'done';

// base controller for tasks
export default function(controller) {

	/**
	 * 		INDEX functions of tasks
	 */
	
	/**
	* 	START OF YOUR DAY
	*/

	startDayFlowController(controller);

	/**
	 * 		YOUR DAILY TASKS
	 */

	controller.hears(['daily_tasks'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var channel       = message.channel;

		// find user then get tasks
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// temporary fix to get tasks
			var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
			models.DailyTask.findAll({
				where: [`"DailyTask"."createdAt" > ? AND "Task"."UserId" = ?`, timeAgoForTasks, user.id],
				order: `"priority" ASC`,
				include: [ models.Task ]
			}).then((dailyTasks) => {
				
				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

				var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
				taskListMessage = `Here are your tasks for today! :memo:\n${taskListMessage}`;

				bot.send({
		        type: "typing",
		        channel
		    });
		    setTimeout(()=>{
		    	bot.reply(message, taskListMessage);
		    }, randomInt(1000, 2000));

			});

		})


	});

};