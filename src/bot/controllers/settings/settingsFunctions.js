import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, getSettingsAttachment } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog, witTimeResponseToTimeZoneObject, getSlackUsersFromString } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';

// the home view of user's settings
export function settingsHome(convo) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	let text = `Here are your settings:`;
	let attachments = getSettingsAttachment(settings);
	convo.say({
		text,
		attachments
	});

	askWhichSettingsToUpdate(convo);


}

function askWhichSettingsToUpdate(convo, text = false) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	if (!text)
		text = `Which of these settings would you like me to update?`

	convo.ask({
		text,
		attachments: [{
			callback_id: "UPDATE_SETTINGS",
			fallback: `Would you like to update a settings?`,
			color: colorsHash.grey.hex,
			attachment_type: 'default',
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: "Good for now!",
					value: buttonValues.neverMind.value,
					type: "button"
				}
			]
		}]
	}, [
		{ // change name
			pattern: utterances.containsName,
			callback: (response, convo) => {
				changeName(convo);
				convo.next();
			}
		},
		{ // change timeZone
			pattern: utterances.containsTimeZone,
			callback: (response, convo) => {
				changeTimeZone(convo);
				convo.next();
			}
		},
		{ // change morning ping
			pattern: utterances.containsPing,
			callback: (response, convo) => {
				changeMorningPing(convo);
				convo.next();
			}
		},
		{ // change extend duration
			pattern: utterances.containsExtend,
			callback: (response, convo) => {
				askToChangeExtendDuration(convo);
				convo.next();
			}
		},
		{ // change break duration
			pattern: utterances.containsBreak,
			callback: (response, convo) => {
				askToChangeBreakDuration(convo);
				convo.next();
			}
		},
		{ // change priority sharing
			pattern: utterances.containsPriority,
			callback: (response, convo) => {
				changePrioritySharing(convo);
				convo.next();
			}
		},
		{
			// no or never mind to exit this flow
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know whenever you want to \`edit settings\``);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				const text = "Sorry, I didn't get that. Which specific settings would you like to update? `i.e. morning ping`";
				askWhichSettingsToUpdate(convo, text);
				convo.next();
			}
		}
	]);

}

// user wants to change name
function changeName(convo) {

	let { settings: { nickName } } = convo;

	convo.ask({
		text: "What would you like me to call you?",
		attachments: [{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_NAME",
			fallback: "What would you like me to call you?",
			actions: [
				{
					name: buttonValues.keepName.name,
					text: `Keep my name!`,
					value: buttonValues.keepName.value,
					type: "button"
				}
			]
		}]
	}, [
		{
			pattern: utterances.containsKeep,
			callback: (response, convo) => {

				convo.say(`Phew :sweat_smile: I really like the name ${nickName} so I'm glad you kept it`);
				settingsHome(convo);
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {
				nickName = response.text;
				convo.settings.nickName = nickName;
				convo.say(`Ooh I like the name ${nickName}! It has a nice ring to it`);
				settingsHome(convo);
				convo.next();
			}
		}
	]);
}

// user wants to change timezone
function changeTimeZone(convo) {

	const { settings: { SlackUserId, timeZone, pingTime } } = convo;

	convo.ask({
		text: `I have you in the *${timeZone.name}* timezone. What timezone are you in now?`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_TIMEZONE",
				fallback: "What's your timezone?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.timeZones.eastern.name,
						text: `Eastern`,
						value: buttonValues.timeZones.eastern.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.central.name,
						text: `Central`,
						value: buttonValues.timeZones.central.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.mountain.name,
						text: `Mountain`,
						value: buttonValues.timeZones.mountain.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.pacific.name,
						text: `Pacific`,
						value: buttonValues.timeZones.pacific.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.other.name,
						text: `Other`,
						value: buttonValues.timeZones.other.value,
						type: "button"
					}
				]
			}
		]
	}, [
			{
				pattern: utterances.other,
				callback: (response, convo) => {
					convo.say("I’m only able to work in these timezones right now. If you want to demo Toki, just pick one of these timezones. I’ll try to get your timezone included as soon as possible!");
					convo.repeat();
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				const { text }  = response;
				let newTimeZone = false;

				switch (text) {
					case (text.match(utterances.eastern) || {}).input:
						newTimeZone = timeZones.eastern;
						break;
					case (text.match(utterances.central) || {}).input:
						newTimeZone = timeZones.central;
						break;
					case (text.match(utterances.mountain) || {}).input:
						newTimeZone = timeZones.mountain;
						break;
					case (text.match(utterances.pacific) || {}).input:
						newTimeZone = timeZones.pacific;
					default:
						break;
				}

				if (newTimeZone) {

					const oldTimeZone       = convo.settings.timeZone;
					convo.settings.timeZone = newTimeZone;

					// update pingTime to accommodate change in timezone!
					if (pingTime) {
						let now = moment();
						let oldTimeZoneOffset = moment.tz.zone(oldTimeZone.tz).offset(now);
						let newTimeZoneOffset = moment.tz.zone(newTimeZone.tz).offset(now);
						let hoursOffset = (newTimeZoneOffset - oldTimeZoneOffset) / 60
						const newMorningPingTime = moment(pingTime).add(hoursOffset, 'hours');
						convo.settings.pingTime = newMorningPingTime;
					}
						
					settingsHome(convo);

				} else {
					convo.say("I didn't get that :thinking_face:");
					convo.repeat();
				}

				convo.next();
			}
		}
	]);

}

function askToChangeExtendDuration(convo) {

	let { settings: { defaultSnoozeTime } } = convo;
	let attachments;
	let text;

	if (defaultSnoozeTime) {

		convo.say(`Your default for extending sessions is ${defaultSnoozeTime} minutes`);
		
		text = `This is the default that happens when you click \`Extend for ${defaultSnoozeTime} min\`. You can always specify a custom time by saying \`extend for 1 hr\` or however long you’d like to work`;
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_EXTEND_DURATION",
				fallback: "What do you want your default time to be?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.changeTime.name,
						text: `Change Default Time`,
						value: buttonValues.changeTime.value,
						type: "button"
					},
					{
						name: buttonValues.no.name,
						text: `Never Mind`,
						value: buttonValues.no.value,
						type: "button"
					}
				]
			}
		]

	} else {

		// DEFAULT HAS NOT BEEN SET YET
		text = `Extend duration is the default amount of time you want to extend a session when the timer is up and you click \`Extend for 15 min\`. You can always specify a custom time then by saying \`extend for 1 hr\` or however long you’d like to work`;
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_EXTEND_DURATION",
				fallback: "What do you want your default time to be?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.setTime.name,
						text: `Set Default Time`,
						value: buttonValues.setTime.value,
						type: "button"
					},
					{
						name: buttonValues.no.name,
						text: `Never Mind`,
						value: buttonValues.no.value,
						type: "button"
					}
				]
			}
		]

	}

	convo.ask({
		text,
		attachments
	},[
		{
			pattern: utterances.containsChange,
			callback: (response, convo) => {
				changeExtendDurationTime(convo);
				convo.next();
			}
		},
		{
			pattern: utterances.setTime,
			callback: (response, convo) => {
				changeExtendDurationTime(convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Okay!");
				showSettingsOptions(convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say(`Sorry I didn't get that`);
				convo.repeat();
				convo.next();
			}
		}
	]);


}

function changeExtendDurationTime(convo) {

	let { settings: { defaultSnoozeTime } } = convo;
	convo.ask(`How long would you like to typically extend sessions by?`, (response, convo) => {
		// must be a number
		let time    = response.text;
		let minutes = false;
		let validMinutesTester = new RegExp(/[\dh]/);

		if (validMinutesTester.test(time)) {
			minutes = convertTimeStringToMinutes(time);
		}

		if (minutes) {
			convo.settings.defaultSnoozeTime = minutes;
			convo.say(`Looks great! I’ll set ${minutes} minutes as your new default for extending sessions :timer_clock:`);
			settingsHome(convo);
		} else {
			convo.say("Sorry, still learning :dog:. Let me know in terms of minutes `i.e. 10 min`");
			convo.repeat();
		}
		convo.next();
	});

}

function askToChangeBreakDuration(convo) {

	let { settings: { defaultBreakTime } } = convo;
	let attachments;
	let text;

	if (defaultBreakTime) {

		convo.say(`Your default for breaks between sessions is ${defaultBreakTime} minutes`);
		
		text = `This is the default that happens when you click \`Break for ${defaultBreakTime} min\`. You can always specify a custom time by saying \`break for 20 minutes\` or however long you’d like to relax :palm_tree:`;
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_BREAK_DURATION",
				fallback: "What do you want your default time to be?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.changeTime.name,
						text: `Change Default Time`,
						value: buttonValues.changeTime.value,
						type: "button"
					},
					{
						name: buttonValues.no.name,
						text: `Never Mind`,
						value: buttonValues.no.value,
						type: "button"
					}
				]
			}
		]

	} else {

		// DEFAULT HAS NOT BEEN SET YET
		text = `Break duration is the default amount of time you want to take a break for in between sessions and click \`Break for 10 min\`. You can always specify a custom time by saying \`break for 20 minutes\` or however long you’d like to relax :palm_tree:`;
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_BREAK_DURATION",
				fallback: "What do you want your default time to be?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.setTime.name,
						text: `Set Default Time`,
						value: buttonValues.setTime.value,
						type: "button"
					},
					{
						name: buttonValues.no.name,
						text: `Never Mind`,
						value: buttonValues.no.value,
						type: "button"
					}
				]
			}
		]

	}

	convo.ask({
		text,
		attachments
	},[
		{
			pattern: utterances.containsChange,
			callback: (response, convo) => {
				changeBreakDurationTime(convo);
				convo.next();
			}
		},
		{
			pattern: utterances.setTime,
			callback: (response, convo) => {
				changeBreakDurationTime(convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Okay!");
				showSettingsOptions(convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say(`Sorry I didn't get that`);
				convo.repeat();
				convo.next();
			}
		}
	]);


}

function changeBreakDurationTime(convo) {

	let { settings: { defaultBreakTime } } = convo;
	convo.ask(`How long would you like to typically break between sessions?`, (response, convo) => {
		// must be a number
		let time    = response.text;
		let minutes = false;
		let validMinutesTester = new RegExp(/[\dh]/);

		if (validMinutesTester.test(time)) {
			minutes = convertTimeStringToMinutes(time);
		}

		if (minutes) {
			convo.settings.defaultBreakTime = minutes;
			convo.say(`Looks great! I’ll set ${minutes} minutes as your new default break time :timer_clock:`);
			settingsHome(convo);
		} else {
			convo.say("Sorry, still learning :dog:. Let me know in terms of minutes `i.e. 10 min`");
			convo.repeat();
		}
		convo.next();
	});

}

// user wants to change morning ping
function changeMorningPing(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	if (pingTime) {
		if (wantsPing) {
			// has ping right now and probably wants to disable
			editLivePingTime(convo);
		} else {
			// has ping time that is disabled, so can enable
			editDisabledPingTime(convo);
		}
	} else {
		// no existing ping time!
		setNewPingTime(convo);
		
	}

}

// live ping time ethat exists
function editLivePingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;
	let currentPingTimeObject = moment(pingTime).tz(timeZone.tz);
	let currentPingTimeString = currentPingTimeObject.format("h:mm a");

	const text = `Your Morning Ping is set to ${currentPingTimeString} and it’s currently *enabled* so you are receiving a greeting each weekday morning to make a plan to win your day :medal:`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.changeTime.name,
					text: `Change Time :clock7:`,
					value: buttonValues.changeTime.value,
					type: "button"
				},
				{
					name: buttonValues.disable.name,
					text: `Disable`,
					value: buttonValues.disable.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	]

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.containsChange,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.containsDisable,
				callback: (response, convo) => {

					convo.settings.wantsPing = false;
					convo.say(`Consider it done (because it is done :stuck_out_tongue_winking_eye:). You are no longer receiving morning pings each weekday`);
					settingsHome(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// disabled ping time that exists
function editDisabledPingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;
	let currentPingTimeObject = moment(pingTime).tz(timeZone.tz);
	let currentPingTimeString = currentPingTimeObject.format("h:mm a");

	const text = `Your Morning Ping is set to ${currentPingTimeString} but it’s currently *disabled* so you’re not receiving a greeting each weekday morning to make a plan to win your day`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.keepTime.name,
					text: `Enable + Keep Time`,
					value: buttonValues.keepTime.value,
					type: "button"
				},
				{
					name: buttonValues.changeTime.name,
					text: `Enable + Change Time`,
					value: buttonValues.changeTime.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	]

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.containsChange,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					convo.say(`I love how you’re getting after it :raised_hands:`);
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.containsKeep,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					convo.say(`Got it! I’ll ping you at ${currentPingTimeString} to make a plan to win your day :world_map:`);
					settingsHome(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// ping time for the first time!
function setNewPingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	const text = `Would you like me to reach out each weekday morning to encourage you to make a plan to  achieve your most important outcomes?`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.yes.name,
					text: `Yes!`,
					value: buttonValues.yes.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Not right now`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	]

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.yes,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					convo.say(`I love how you’re getting after it :raised_hands:`);
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// ask to change the ping time!
function changePingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	convo.ask(`What time would you like me to reach out?`, (response, convo) => {

		const { intentObject: { entities: { datetime } } } = response;
		let customTimeObject = witTimeResponseToTimeZoneObject(response, timeZone.tz);
		let now = moment();

		if (customTimeObject && datetime) {

			// datetime success!
			convo.settings.pingTime = customTimeObject;
			let timeString = customTimeObject.format("h:mm a");
			convo.say(`Got it! I’ll ping you at ${timeString} to make a plan to win your day :world_map:`);
			convo.say(`I hope you have a great rest of the day!`);
			settingsHome(convo);
			convo.next();

		} else {
			convo.say("Sorry, I didn't get that :thinking_face: let me know a time like `8:30am`");
			convo.repeat();
		}
		convo.next();
	});
}

// user wants to change priority sharing
function changePrioritySharing(convo) {

	const { settings: { includeOthersDecision, includedSlackUsers } } = convo;

	if (includedSlackUsers.length > 0) {

		if (includeOthersDecision == "NO_FOREVER") {
			// user intentionally DISABLED INCLUDED SLACKUSERS
			disabledIncludedSlackUsersOptions(convo);
		} else {
			// user is currently sharing with them
			includedSlackUsersOptions(convo);
		}

	} else {

		// user has nobody included i.e. DISABLED
		let text = `Would you like to share your daily plan with a colleague? Just mention a Slack username like \`@emily\` and I’ll share your priorities with them each time you make a plan`;
		askForIncluded(convo, text);
		convo.next();

	}

}

function includedSlackUsersOptions(convo) {

	const { settings: { includeOthersDecision, includedSlackUsers } } = convo;
	let includedSlackUsersNames = commaSeparateOutTaskArray(includedSlackUsers.map(slackUser => slackUser.dataValues.SlackName), { slackNames: true });

	let text = `You're sharing your daily plan with *${includedSlackUsersNames}*`;
	let attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_INCLUDED_MEMBERS",
			fallback: "Who do you want to include on your plan?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.disable.name,
					text: `Disable`,
					value: buttonValues.disable.value,
					type: "button"
				},
				{
					name: buttonValues.shareWithOthers.name,
					text: `Share with other`,
					value: buttonValues.shareWithOthers.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	];

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.containsDisable,
				callback: (response, convo) => {
					convo.say(`Got it! I will not be sharing your plan with anyone :punch: (unless you tell me to, in which case I’ll oblige you)`);
					convo.settings.includeOthersDecision = "NO_FOREVER";
					settingsHome(convo);
					convo.next();
				}
			},
			{
				pattern: utterances.containsShare,
				callback: (response, convo) => {
					askForIncluded(convo);
					convo.next();
				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`You can always add this later!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
				convo.say(`Sorry I didn't quite catch that`);
				convo.repeat();
				convo.next();
			}

		}
	]);

}

function disabledIncludedSlackUsersOptions(convo) {

	const { settings: { includeOthersDecision, includedSlackUsers } } = convo;
	let includedSlackUsersNames = commaSeparateOutTaskArray(includedSlackUsers.map(slackUser => slackUser.dataValues.SlackName), { slackNames: true });

	let text = `You have *${includedSlackUsersNames}* to be included in your daily plan, but it’s currently *_disabled_* so I'm not sharing with them`;
	let attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_INCLUDED_MEMBERS",
			fallback: "Who do you want to include on your plan?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.keepPerson.name,
					text: `Enable + Keep Person`,
					value: buttonValues.keepPerson.value,
					type: "button"
				},
				{
					name: buttonValues.changePerson.name,
					text: `Enable + Change Per.`,
					value: buttonValues.changePerson.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	];

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.containsKeep,
				callback: (response, convo) => {
					convo.say(`Got it! I’ll share your daily plan with *${includedSlackUsersNames}*`);
					convo.settings.includeOthersDecision = "default";
					settingsHome(convo);
					convo.next();
				}
			},
			{
				pattern: utterances.containsChange,
				callback: (response, convo) => {
					askForIncluded(convo);
					convo.next();
				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`You can always add this later!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
				convo.say(`Sorry I didn't quite catch that`);
				convo.repeat();
				convo.next();
			}

		}
	]);

}

// ask to include others
function askForIncluded(convo, text = false) {

	const { settings: { includeOthersDecision, includedSlackUsers } } = convo;

	if (!text) {
		text = `Who would you like to share your daily plan with? Just mention a Slack username like \`@emily\` and I’ll share your priorities with them each time you make a plan`;
	}

	let attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_INCLUDED_MEMBERS",
			fallback: "Who do you want to include on your plan?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.no.name,
					text: `Not right now`,
					value: buttonValues.no.value,
					type: "button"
				}
			]
		}
	];

	convo.ask({
		text,
		attachments
	}, [
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`You can always add this later!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				// add included teammembers
				let { text } = response;

				let includeSlackUserIds = getSlackUsersFromString(text);

				if (includeSlackUserIds) {

					models.SlackUser.findAll({
						where: [ `"SlackUser"."SlackUserId" IN (?)`, includeSlackUserIds],
						include: [ models.User ]
					})
					.then((slackUsers) => {

						// success!
						let names = slackUsers.map(slackUser => slackUser.dataValues.SlackName || slackUser.dataValues.User.nickName );
						convo.settings.includedSlackUsers = slackUsers;
						if (includeOthersDecision == "NO_FOREVER") {
							convo.settings.includeOthersDecision = "default";
						}
						let nameStrings = commaSeparateOutTaskArray(names, { slackNames: true });
						convo.say(`Great! After planning, I’ll let *${nameStrings}* know that you’ll be focused on these priorities today. You can add someone to receive your priorities automatically when you make them each morning by saying \`show settings\``);
						settingsHome(convo);

					});

				} else {

					convo.say(`I’m sorry, I couldn't find the member you wanted to include. Is there another name this person goes by in Slack? Please enter their Slack username, like \`@matt\` (it should autocomplete)`);
					text = `Who are the members you want to include?`;
					askForIncluded(convo, text);

				}

				convo.next();

			}

		}
	]);

}


function changeMorningPing(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	if (pingTime) {
		if (wantsPing) {
			// has ping right now and probably wants to disable
			editLivePingTime(convo);
		} else {
			// has ping time that is disabled, so can enable
			editDisabledPingTime(convo);
		}
	} else {
		// no existing ping time!
		setNewPingTime(convo);
		
	}

}


