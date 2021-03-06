/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { constants, buttonValues, colorsHash, quotes, approvalWords, startSessionExamples, utterances, specialNumbers, decaNumbers } from './constants';
import nlp from 'nlp_compromise';
import moment from 'moment-timezone';
import _ from 'lodash';

export function getRandomExample(type, config = {}) {

	let example = false;
	switch (type) {
		case "session":
			example = startSessionExamples[Math.floor(Math.random()*startSessionExamples.length)]
			break;
		case "approvalWord":
			example = approvalWords[Math.floor(Math.random()*approvalWords.length)];
			break;
		default: break;
	}

	if (config.upperCase) {
		example = capitalizeFirstLetter(example);
	}

	return example;

}

function capitalizeFirstLetter(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * take in time response object and convert it to remindTimeStamp moment obj
 * @param  {obj} response response object
 * @return {moment-tz object}
 */
export function witTimeResponseToTimeZoneObject(response, tz) {

	console.log("\n\n response obj in witTimeResponseToTimeZoneObject \n\n")

	var { text, intentObject: { entities } } = response;
	const { duration, datetime } = entities;

	var now = moment();
	var remindTimeStamp;

	if ((!datetime && !duration) || !tz) {
		remindTimeStamp = false; // not valid
	} else {

		if (duration) {
			var durationSeconds = 0;
			for (var i = 0; i < duration.length; i++) {
				durationSeconds += duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);
			remindTimeStamp = now.tz(tz).add(durationSeconds, 'seconds');
		}

		if (datetime) {

			var dateTime = datetime[0]; // 2016-06-24T16:24:00.000-04:00

			// make it the same timestamp
			if (dateTime.type == "interval") {
				remindTimeStamp = dateTime.to.value;
			} else {
				remindTimeStamp = dateTime.value;
			}
			
			// handle if it is a duration configured intent
			if (constants.DURATION_INTENT.reg_exp.test(response.text) && !constants.TIME_INTENT.reg_exp.test(response.text)) {

				console.log("\n\n ~~ interpreted datetime as duration ~~ \n");
				console.log(response.text);
				console.log(remindTimeStamp);
				console.log("\n\n");

				remindTimeStamp = moment(remindTimeStamp).tz(tz);
			} else {
				remindTimeStamp = dateStringToMomentTimeZone(remindTimeStamp, tz);
			}

		}
	}

	return remindTimeStamp;

}

export function witDurationToTimeZoneObject(duration, tz) {
	
	var now = moment();
	var remindTimeStamp;

	if (duration) {
		var durationSeconds = 0;
		for (var i = 0; i < duration.length; i++) {
			durationSeconds += duration[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		remindTimeStamp = now.tz(tz).add(durationSeconds, 'seconds');
		return remindTimeStamp;
	} else {
		return false;
	}
}

// convert wit duration to total minutes
export function witDurationToMinutes(duration) {

	var now = moment();
	var remindTimeStamp;

	if (duration) {
		var durationSeconds = 0;
		for (var i = 0; i < duration.length; i++) {
			durationSeconds += duration[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		return durationMinutes;
	} else {
		return false;
	}

}

/**
 * i.e. `75` => `1 hour 15 minutes`
 * @param  {int} minutes number of minutes
 * @return {string}         hour + minutes
 */
export function convertMinutesToHoursString(minutes, config = {}) {

	const { abbreviation } = config;

	minutes = Math.round(minutes);
	var hours = 0;
	while (minutes - 60 >= 0) {
		hours++;
		minutes-=60;
	}
	var content = '';
	if (hours == 0) {
		content = ``;
	} else if (hours == 1) {
		content = abbreviation ? `${hours} hr ` : `${hours} hour `;
	} else {
		content = abbreviation ? `${hours} hrs ` : `${hours} hours `;
	}

	if (minutes == 0) {
		content = content.slice(0, -1);
	} else if (minutes == 1) {
		content = abbreviation ? `${content}${minutes} min` : `${content}${minutes} minute`;
	} else {
		content = abbreviation ? `${content}${minutes} min` : `${content}${minutes} minutes`;
	}

	// for 0 time spent
	if (minutes == 0 && hours == 0) {
		content = `less than a minute`;
	}

	return content;
}

/**
 * convert a string of hours and minutes to total minutes int
 * @param  {string} string `1hr 2m`, `25 min`, etc.
 * @return {int}        number of minutes int
 * HACKY / temporary solution...
 */
export function convertTimeStringToMinutes(timeString) {

	var totalMinutes = 0;
	timeString = timeString.split(/(\d+)/).join(' '); // add proper spaces in b/w numbers so we can then split consistently
	var timeArray = timeString.split(" ");

	var aOrAnRegExp       = new RegExp(/\b[an]{1,3}/i);

	var totalMinutesCount = 0; // max of 1
	var totalHoursCount = 0; // max of 1

	// let's get rid of all space
	timeArray = timeArray.filter((value) => {
		if (value != "")
			return true;
	});

	for (var i = 0; i < timeArray.length; i++) {

		var aOrAnRegExp = new RegExp(/\b[an]{1,3}/i);

		if (nlp.value(timeArray[i]).number) {
			timeArray[i] = `${nlp.value(timeArray[i]).number}`;
		} else if (aOrAnRegExp.test(timeArray[i])) {
			timeArray[i] = "1";
		}
		
		var numberValue = timeArray[i].match(/\d+/);
		if (!numberValue) {
			continue;
		}

		var minutes = 0;

		// OPTION 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseFloat(timeArray[i])) {
			minutes = parseFloat(timeArray[i]);
			var hourOrMinute = timeArray[i+1];
			if (hourOrMinute && hourOrMinute[0] == "h") {
				minutes *= 60;
				totalHoursCount++;
			} else {
				// number greater than 0
				if (minutes > 0) {
					totalMinutesCount++;
				}
			}
		} else {
			// OPTION 2: No space b/w ints (i.e. 1hr)
		
			// need to check for "h" or "m" in these instances
			var timeString = timeArray[i];
			var containsH = new RegExp(/[h]/);
			var timeStringArray = timeString.split(containsH);
			
			timeStringArray.forEach(function(element, index) {
				var time = parseFloat(element); // can be minutes or hours
				if (isNaN(parseFloat(element)))
					return;
				
				// if string contains "h", then you can assume first one is hour
				if (containsH.test(timeString)) {
					if (index == 0) {
						// hours
						minutes += 60 * time;  
						totalHoursCount++;
					} else {
						// minutes
						minutes += time;
						totalMinutesCount++;
					}
				} else {
					minutes += time;
					totalMinutesCount++;
				}
				
			});
			
		}
		
		if (totalMinutesCount > 1 || totalHoursCount > 1) {
			continue;
		}
		totalMinutes += minutes;

	}

	
	return totalMinutes;
}

/**
 * takes wit timestring and returns a moment timezone
 * ~ we are always assuming user means the SOONEST FUTURE time from now ~
 * 
 * @param  {string} timeString full Wit timestamp string, ex. `2016-06-24T16:24:00.000-04:00`
 * @param  {string} timeZone   timezone in DB, ex. `America/Los_Angeles`
 * @return {moment}            moment object with appropriate timezone
 */
export function dateStringToMomentTimeZone(timeString, timeZone) {

	// turns `2016-06-24T16:24:00.000-04:00` into `["2016", "06", "24", "16:24:00.000", "04:00"]`
	var splitter = new RegExp(/[T-]+/);
	var dateArray = timeString.split(splitter);
	if (dateArray.length != 5) {
		console.log("\n\n\n ~~ THIS IS NOT A CORRECTLY FORMATTED WIT STRING: SHOULD BE FORMAT LIKE `2016-06-24T16:24:00.000-04:00`! ~~ \n\n");
		return false;
	} else if (!timeZone) {
		console.log("\n\n\n ~~ INVALID TIME ZONE. WE NEED A TIME ZONE ~~ \n\n");
		return false;
	}

	var time = dateArray[3]; // ex. "16:24:00.000"
	console.log(`\n\n ~~ working with time: ${time} in timezone: ${timeZone} ~~ \n\n`);
	
	// we must interpret based on user's timezone
	var now     = moment.tz(timeZone);
	var nowTime = now.format("HH:mm:ss");

	var date;
	if (time > nowTime) {
		// user time is greater than now, so we can keep the date
		date = now.format("YYYY-MM-DD");
	} else {
		// user time is less than now, so we assume the NEXT day
		var nextDay = now.add(1, 'days');
		date        = nextDay.format("YYYY-MM-DD");
	}

	var dateTimeFormat = `${date} ${time}`; // string to create our moment obj.
	var userMomentTimezone = moment.tz(dateTimeFormat, timeZone);

	return userMomentTimezone;

}

/**
 * get array of slackUserIds from string
 * @param  {string input} string "ping <@UIXUXUXU>" // done automatically
 * @return {array of SlackUserIds} ['UIXUXUXU'];
 */
export function getUniqueSlackUsersFromString(string, config = {}) {

	const { normalSlackNames } = config;
	// by default will get translated into SlackUserId
	const slackUserIdContainer = normalSlackNames ? new RegExp(/@(\S*)/g) : new RegExp(/<@(.*?)>/g);
	const replaceRegEx = new RegExp(/<|>|@/g);
	
	let arrayString = string.match(slackUserIdContainer);
	let slackUserIds = [];

	if (arrayString) {
		arrayString.forEach((string) => {
			const slackUserId = string.replace(replaceRegEx, "");
			if (!_.includes(slackUserIds, slackUserId)) {
				slackUserIds.push(slackUserId);
			}
		});
		if (slackUserIds.length == 0) {
			return false;
		} else {
			return slackUserIds;
		}
	} else {
		return false;
	}
	
}

// returns array joined together into a string
export function commaSeparateOutStringArray(a, config = {}) {

	const { codeBlock, slackNames, SlackUserIds } = config;

	a = a.map((a) => {
		if (codeBlock) {
			a = `\`${a}\``
		} else if (slackNames) {
			a = `@${a}`;
		} else if (SlackUserIds) {
			a = `<@${a}>`;
		}
		return a;
	})

	// make into string
	let string = [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
	return string;

}

// this is for deleting the most recent message!
// mainly used for convo.ask, when you do natural language instead
// of clicking the button
export function getMostRecentMessageToUpdate(userChannel, bot, callbackId = false) {
	
	let { sentMessages } = bot;

	let updateTaskListMessageObject = false;
	if (sentMessages && sentMessages[userChannel]) {

		let channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (let i = channelSentMessages.length - 1; i >= 0; i--) {

			const { channel, ts, attachments } = channelSentMessages[i];

			if (channel == userChannel) {
				if ( callbackId && attachments && callbackId == attachments[0].callback_id) {
					updateTaskListMessageObject = {
						channel,
						ts
					};
					break;
				} else {
					updateTaskListMessageObject = {
						channel,
						ts
					};
					break;
				}
			}
		}
	}

	return updateTaskListMessageObject;

}

export function stringifyNumber(n) {
	if (n < 20) return specialNumbers[n];
	if (n%10 === 0) return decaNumbers[Math.floor(n/10)-2] + 'ieth';
	return deca[Math.floor(n/10)-2] + 'y-' + specialNumbers[n%10];
}

export function getPingMessageContentAsAttachment(ping) {

	let pingMessagesContent = ``;

	ping.dataValues.PingMessages.forEach((pingMessage) => {
		const pingMessageContent = pingMessage.dataValues.content;
		pingMessagesContent      = `${pingMessagesContent}\n${pingMessageContent}`
	});

	let attachments = [
		{
			attachment_type: 'default',
			fallback: `Let's start this conversation!`,
			mrkdwn_in: ["text"],
			callback_id: "PING_MESSAGE",
			color: colorsHash.toki_purple.hex,
			text: pingMessagesContent
		}
	];
	return attachments;

}

// this is for more than one ping
export function getGroupedPingMessagesAsAttachment(pings) {

	let groupedPingMessagesAttachment = [];

	pings.forEach((ping, index) => {

		const numberString = stringifyNumber(index + 1);

		let pingMessagesContent = ``;

		ping.dataValues.PingMessages.forEach((pingMessage) => {
			const pingMessageContent = pingMessage.dataValues.content;
			pingMessagesContent      = `${pingMessagesContent}\n${pingMessageContent}`
		});

		groupedPingMessagesAttachment.push({
			attachment_type: 'default',
			fallback: `Here is the ${numberString} ping!`,
			pretext: `*Here is the ${numberString} ping:*`,
			mrkdwn_in: ["text", "pretext"],
			callback_id: "PING_MESSAGE",
			color: colorsHash.toki_purple.hex,
			text: pingMessagesContent
		});

	});

	return groupedPingMessagesAttachment;

}

// this is for more than one ping
// pings must have sessino attached to it!
export function whichGroupedPingsToCancelAsAttachment(pings) {

	let groupedPingMessagesAttachment = [];

	pings.forEach((ping, index) => {

		const { dataValues: { ToUser, session } } = ping;
		const endTimeObject = moment(session.dataValues.endTime);
		const endTimeString = endTimeObject.format("h:mma");

		const numberString = stringifyNumber(index + 1);
		let count = index+1;

		let pingMessagesContent = ``;

		ping.dataValues.PingMessages.forEach((pingMessage) => {
			const pingMessageContent = pingMessage.dataValues.content;
			pingMessagesContent      = `${pingMessagesContent}\n${pingMessageContent}`
		});

		groupedPingMessagesAttachment.push({
			attachment_type: 'default',
			fallback: `${count}) Ping to <@${ToUser.dataValues.SlackUserId}> at ${endTimeString} or sooner:`,
			pretext: `${count}) Ping to <@${ToUser.dataValues.SlackUserId}> at ${endTimeString} or sooner:`,
			mrkdwn_in: ["text", "pretext"],
			callback_id: "PING_MESSAGE",
			color: colorsHash.toki_purple.hex,
			text: pingMessagesContent
		});

	});

	return groupedPingMessagesAttachment;

}


export function getHandleQueuedPingActions(ping) {

	let actions = [];

	if (ping && ping.dataValues) {
		actions = [
			{
				name: buttonValues.sendNow.name,
				text: "Send now :bomb:",
				value: `{"updatePing": true, "sendBomb": true, "PingId": "${ping.dataValues.id}"}`,
				type: "button"
			},
			{
				name: buttonValues.cancelPing.name,
				text: "Cancel ping :negative_squared_cross_mark:",
				value: `{"updatePing": true, "cancelPing": true, "PingId": "${ping.dataValues.id}"}`,
				type: "button"
			}
		];
	}
		
	return actions;
}

// include ping actions if > 0 pings
export function getStartSessionOptionsAttachment(pings, config = {}) {

	const { customOrder, order } = config;
	let attachments = [];

	let deferredPingsText = pings.length == 1 ? "Defer Ping :arrow_right:" : "Defer Pings :arrow_right:";
	let cancelPingsText   = pings.length == 1 ? "Cancel Ping :negative_squared_cross_mark:" : "Cancel Ping(s) :negative_squared_cross_mark:";

	if (customOrder && order) {

		attachments = [
			{
				attachment_type: 'default',
				callback_id: "LIVE_SESSION_OPTIONS",
				fallback: "Good luck with your session!",
				actions: []
			}
		];

		order.forEach((order) => {

			switch (order) {
				case `changeTimeAndTask`:
					attachments[0].actions.push({
						name: buttonValues.changeTimeAndTask.name,
						text: "Change Time + Task",
						value: buttonValues.changeTimeAndTask.value,
						type: "button"
					})
					break;
				case `deferPing`:
					attachments[0].actions.push({
						name: buttonValues.deferPing.name,
						text: deferredPingsText,
						value: buttonValues.deferPing.value,
						type: "button"
					});
					break;
				case `cancelPing`:
					attachments[0].actions.push({
						name: buttonValues.cancelPing.name,
						text: cancelPingsText,
						value: buttonValues.cancelPing.value,
						type: "button"
					});
					break;
				case `endSession`:
					attachments[0].actions.push({
						name: buttonValues.endSession.name,
						text: "End Session",
						value: buttonValues.endSession.value,
						type: "button"
					});
					break;
				case `sendSooner`:
					attachments[0].actions.push({
						name: buttonValues.sendSooner.name,
						text: "Send Sooner",
						value: buttonValues.sendSooner.value,
						type: "button"
					});
				default: break;
			}

		});

		return attachments;

	} else {
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "LIVE_SESSION_OPTIONS",
				fallback: "Good luck with your session!",
				actions: [
					{
						name: buttonValues.changeTimeAndTask.name,
						text: "Change Time + Task",
						value: buttonValues.changeTimeAndTask.value,
						type: "button"
					},
					{
						name: buttonValues.endSession.name,
						text: "End Session",
						value: buttonValues.endSession.value,
						type: "button"
					}
				]
			}
		];

		if (pings.length > 0) {

			let pingActions = [{
				name: buttonValues.deferPing.name,
				text: deferredPingsText,
				value: buttonValues.deferPing.value,
				type: "button"
			},
			{
				name: buttonValues.cancelPing.name,
				text: cancelPingsText,
				value: buttonValues.cancelPing.value,
				type: "button"
			}];

			let fullActionsArray   = _.concat(pingActions, attachments[0].actions);
			attachments[0].actions = fullActionsArray;

		}
	}

	

	return attachments;
}

/**
 * takes in user input for tasks done `4, 1, 3` and converts it to an array of the numbers
 * @param  {string} taskCompletedString `4, 1, 3` (only uniques!)
 * @param {int} maxNumber if number is higher than this it is invalid!
 * @return {[integer]}                     [4, 1, 3] * if valid *
 */
export function convertNumberStringToArray(numbersString, maxNumber) {

	const splitter        = RegExp(/(,|\ba[and]{1,}\b|\bthen\b)/);
	let numbersSplitArray = numbersString.split(splitter);

	// if we capture 0 valid tasks from string, then we start over
	let numberRegEx          = new RegExp(/[\d]+/);
	let validNumberArray = [];
	
	numbersSplitArray.forEach((numberString) => {

		let number = numberString.match(numberRegEx);

		// if it's a valid number and within the remainingTasks length
		if (number && number <= maxNumber) {
			number = parseInt(number[0]);
			if (!_.includes(validNumberArray, number)) {
				validNumberArray.push(number);
			}
		}

	});

	if (validNumberArray.length == 0) {
		return false;
	} else {
		return validNumberArray;
	}

}

// get the session content from message object
// if DateTime, it will get the reminder unless the 2nd or 3rd to last word is "until" or "to"
// if Duration, it will get the reminder unless the 2nd or 3rd to last word is "for"
// if no DateTime or Duration, will just get the message text
// if it has Duration || DateTime and no reminder, then content will be false
export function getSessionContentFromMessageObject(message) {

	const { text, intentObject: { entities: { intent, reminder, duration, datetime } } } = message;

	let textArray = text.split(" ");
	let content   = false;

	if (duration) {

		if (_.nth(textArray, -2) == "for") {

			textArray = textArray.slice(0, -2);
			content   = textArray.join(" ");

		} else if (_.nth(textArray, -3) == "for") {

			textArray = textArray.slice(0, -3);
			content   = textArray.join(" ");

		} else if (reminder) {

			content = reminder[0].value;

		}

	} else if (datetime) {

		if (_.nth(textArray, -2) == "until" || _.nth(textArray, -2) == "to") {

			textArray = textArray.slice(0, -2);
			content   = textArray.join(" ");

		} else if (_.nth(textArray, -3) == "until" || _.nth(textArray, -3) == "to") {

			textArray = textArray.slice(0, -3);
			content   = textArray.join(" ");

		} else if (reminder) {

			content = reminder[0].value;

		}

	} else {
		// if no duration or datetime, we should just use entire text
		content = text;
	}

	return content;

}