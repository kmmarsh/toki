import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';

const FINISH_WORD = 'done';

// base controller for tasks
export default function(controller) {

	/**
	* 	START OF YOUR DAY
	*/

	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		// find user then reply
		models.SlackUser.find({
			where: { SlackUserId },
			include: [
				models.User
			]
		})
		.then((slackUser) => {
			
			bot.send({
        type: "typing",
        channel: message.channel
	    });
	    setTimeout(()=>{
	    	bot.startConversation(message, (err, convo) => {
	    		var name = slackUser.User.nickName || slackUser.User.email;

	    		// configure necessary properties on convo object
	    		convo.name = name;

	    		// object with values that are important to me
	    		convo.dayStart = {
	    			UserId: slackUser.User.id
	    		};

	    		// start the flow
	    		askForDayTasks(err, convo);

	    		// on finish conversation
	    		convo.on('end', (convo) => {

    				var responses = convo.extractResponses();
    				console.log('done!')
    				console.log(responses);
    				console.log("here is day start object:");
    				console.log(convo.dayStart);

	    			// store the user's tasks
    				var { UserId, prioritizedTaskArray } = convo.dayStart;
    				prioritizedTaskArray.forEach((task, index) => {
    					const { text, minutes} = task;
    					var priority = index + 1;
    					models.Task.create({
    						text,
    						minutes,
    						priority,
    						UserId
    					});
    				});

	    			if (convo.status == 'completed') {
	    				bot.reply(message,"thx for finishing");

	    			} else {
	    				// if convo gets ended prematurely
	    				bot.reply(message, "Okay then, never mind!");
	    			}
	    		});

	    	});
	    }, randomInt(1000, 1750));
		});

	});

};

function askForDayTasks(response, convo){

	const { task }                = convo;
	const { bot, source_message } = task;

	console.log("in ask for day tasks");;
	console.log(convo.name);

	convo.say(`Hey ${convo.name}! What tasks would you like to work on today? :pencil:`);
	convo.say(`You can enter everything in one line separated by commas, or send me each task in a separate line`);

	convo.ask(`Then just tell me when you're done by saying \`${FINISH_WORD}\``, (response, convo) => {
		console.log("response is:");
		console.log(response);
		if (response.text == FINISH_WORD) {
			convo.say("Awesome! You can always add more tasks later by telling me, `I'd like to add a task` or something along those lines :grinning:");
			displayTaskList(response, convo);
			convo.next();
		}
	}, { 'key' : 'tasks', 'multiple': true});

}

function displayTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { tasks } = convo.responses;

	var tasks = convo.responses.tasks;
	var taskArray = convertResponseObjectsToTaskArray(tasks);

	// taskArray is now attached to convo
	convo.dayStart.taskArray = taskArray;

	console.log("TASKS:")
	console.log(taskArray);

	var taskListMessage = convertArrayToTaskListMessage(taskArray);

	// we need to prioritize the task list here to display to user
	convo.say(`Now, please rank your tasks in order of your priorities today`);
	convo.say(taskListMessage);
	convo.ask(`You can just list the numbers, like \`3, 4, 1, 2, 5\``, (response, convo) => {
		prioritizeTaskList(response, convo);
		convo.next();
	}, { 'key' : 'taskPriorities' });
	
}

function prioritizeTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task list!
	var { taskArray } = convo.dayStart;

	// get user priority order (`1,4,3,2`), convert it to an array of ints, and use that to prioritize your array
	var initialPriorityOrder = response.text;
	initialPriorityOrder = initialPriorityOrder.split(",").map((order) => {
			return parseInt(order)
	});

	var priorityOrder = [];
	initialPriorityOrder.forEach(function(order) {
		if ( order > 0) {
			order--; // make it 0-index based
			priorityOrder.push(order);
		}
	});

	var prioritizedTaskArray = [];
	priorityOrder.forEach((order) => {
		prioritizedTaskArray.push(taskArray[order]);
	})

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;

	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("Excellent! Last thing: how much time would you like to allocate to each task today?");
				convo.say(taskListMessage);
				convo.ask(`Just say, \`30, 40, 1 hour, 1hr 10 min, 15m\` in order and I'll figure it out and assign those times to the tasks above :smiley:`, (response, convo) => {
					assignTimeToTasks(response, convo);
					convo.next();
				}, { 'key' : 'timeToTasksResponse' });
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("dammit.... ok then.");
				convo.next();
			}
		}
	], { 'key' : 'confirmedRightPriority' });

}

function assignTimeToTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { prioritizedTaskArray } = convo.dayStart;

	var timeToTask = response.text;
	timeToTask = timeToTask.split(",").map((time) => {
		var minutes = convertTimeStringToMinutes(time);
		return minutes;
	});

	prioritizedTaskArray = prioritizedTaskArray.map((task, index) => {
		console.log(index);
		return {
			...task,
			minutes: timeToTask[index]
		}
	});

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;

	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

	convo.say("Are these times right?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("Boom! This looks great");
				convo.ask("Ready to start your first focused work session today?", [
						{
							pattern: bot.utterances.yes,
							callback: (response, convo) => {
								convo.say("Great! It's time for the first session of the day. Let's get crackin :egg:");
								convo.dayStart.startFirstSession = true;
								convo.next();
							}
						},
						{
							pattern: bot.utterances.no,
							callback: (response, convo) => {
								convo.say("Great! Let me know when you're ready to start");
								convo.say("Alternatively, you can ask me to remind you to start at a specific time, like `10am` or a relative time like `in 10 minutes`");
								convo.dayStart.startFirstSession = false;
								convo.next();
							}
						}
					], { 'key' : 'startFirstSession' })
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("ah... well then.");
				convo.next();
			}
		}
	]);

}


/**
 * takes array of tasks and converts to array of task STRINGS
 * @param  {[object]} tasks task OBJECTS
 * @return {[string]}       task STRINGS
 */
function convertResponseObjectsToTaskArray(tasks) {

	var taskString = '';
	tasks.forEach((task, index) => {
		// ignore the last one (`done` command)
		if (task.text == FINISH_WORD)
			return;

		taskString += task.text;
		taskString += '\n';
	});

	const commaOrNewLine = /[,\n]+/;
	var taskStringArray = taskString.split(commaOrNewLine);
	taskStringArray.pop(); // last one will be \n with this reg ex split

	// this is the final task array we are returning
	var taskArray = [];
	taskStringArray.forEach((taskString) => {
		taskString = taskString.trim();
		taskArray.push({
			text: taskString
		})
	});

	return taskArray;
}

function convertArrayToTaskListMessage(taskArray) {
	var taskListMessage = '';
	var count = 1;
	taskArray.forEach((task) => {
		var minutesMessage = task.minutes ? ` (${task.minutes} minutes)` : '';
		taskListMessage += `> ${count}) ${task.text}${minutesMessage}\n`;
		count++;
	});
	return taskListMessage;
}

/**
 * convert a string of hours and minutes to total minutes int
 * @param  {string} string `1hr 2m`, `25 min`, etc.
 * @return {int}        number of minutes int
 * very temporary solution...
 */
function convertTimeStringToMinutes(timeString) {

	var totalMinutes = 0;
	var timeArray = timeString.split(" ");

	for (var i = 0; i < timeArray.length; i++) {
  
  	if (isNaN(parseInt(timeArray[i])))
    	continue;
      
		var minutes = 0;

		// option 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseInt(timeArray[i])) {
    	minutes = parseInt(timeArray[i]);
			var hourOrMinute = timeArray[i+1];
			if (hourOrMinute && hourOrMinute[0] == "h") {
				minutes *= 60;
			}
		} else {
			// option 2: int with no space (i.e. `1hr`)
			// use hacky solution...
			var minutes = parseInt(timeArray[i]);
			var minuteString = String(minutes);
			if (timeArray[i][minuteString.length] == "h") {
				minutes *= 60;
			}
		}

    totalMinutes += minutes;

	}

  
	return totalMinutes;
}


