import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments, letsFocusAttachments, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, commaSeparateOutStringArray } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingContainers, pingInfo }  = convo.sessionEnd;

	let startTimeObject;
	let endTimeObject;
	let endTimeString;
	let sessionMinutes;
	let sessionTimeString;
	let message = ' ';
	let letsFocusMessage = `When you’re ready, let me know when you’d like to focus again`;

	// add session info if existing
	if (session) {
		const { dataValues: { content, startTime, endTime } } = session;
		startTimeObject   = moment(startTime).tz(tz);
		endTimeObject     = moment(endTime).tz(tz);
		endTimeString     = endTimeObject.format("h:mm a");
		sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = convertMinutesToHoursString(sessionMinutes);
	}

	// if this flow is triggered by ended by ping ToUser, and the userId of this session matches with FromUser.UserId of ping
	if (endSessionType == constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {

		// send this only if there are LIVE pings remaining from this user => ToUser ping!

		// ended by someone else. user may or may not be in session
		
		const { PingId, FromUser, ToUser } = pingInfo;

		message = `Hey! <@${ToUser.dataValues.SlackName}> just finished their session`;
		if (pingInfo.endSessionType == constants.endSessionTypes.endSessionEarly) {
			message = `${message} early`;
		}
		message = `${message}\n:point_left: I just kicked off a conversation between you two`;

		if (pingInfo.session) {
			letsFocusMessage = `I ended your focused session on \`${session.dataValues.content}\`. ${letsFocusMessage}`;
		}

	} else if (session) { // session must exist for all endSessionTypes other than endByPingToUserId
		message = `Great work on \`${session.dataValues.content}\`! You were focused for *${sessionTimeString}*`;
	}

	convo.say(message); // this message is relevant to how session got ended (ex. sessionTimerUp vs endByPingToUserId)
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage,
		attachments: letsFocusAttachments
	});

	convo.next();

}

// this handles messaging for all pings to user of ending session
function handleToUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingContainers }  = convo.sessionEnd;
	let message = ' ';

	let slackUserIds = [];
	pingContainers.toUser.forEach((pingContainer) => {
		const { ping: { dataValues: { FromUser } } } = pingContainer;
		if (!_.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	});

	let slackNamesString = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

	if (slackUserIds.length == 1) {
		message = `While you were heads down, ${slackNamesString} asked me to send you a message after your session :relieved:`
	} else if (slackUserIds.length > 1) {
		message = `While you were heads down, you received messages from ${slackNamesString}`;
	}

	convo.say(message);

	message = ' ';
	if (slackUserIds.length == 1) {
		message = `:point_left: I just kicked off a conversation between you both`;
	} else if (slackUserIds.length > 1) {
		message = `:point_left: I just kicked off separate conversations between you and each of them`;
	}

	convo.say(message);
	convo.next();

}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingContainers }  = convo.sessionEnd;
	let message;

	// UserId is fromUserId because it is this user who is ending session

	for (let toUserId in pingContainers.fromUser.toUser) {
		
		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		// if not in superFocus session and they also have msg pinged for you,
		// then their session will end automatically so only one side needs to
		// handle it!
		if (pingContainers.fromUser.toUser[toUserId].session && !pingContainers.fromUser.toUser[toUserId].session.dataValues.superFocus && pingContainers.toUser.fromUser[UserId]) {
			continue;
		}

		const pingContainer      = pingContainers.fromUser.toUser[toUserId];
		const { session, pings } = pingContainer;
		const ToUser             = pingContainer.user;

		if (session) {

			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			convo.say(`<@${ToUser.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*. I'll send your messages at that time, unless this is urgent and you want to send it now`);

			// send ping one at a time, but with context now
			pings.forEach((ping, index) => {

				let actions = [
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

				if (pings.length == 1) {
					convo.say({
						text: "Here is your ping:",
						attachments: [
							{
								attachment_type: 'default',
								callback_id: "SEND_BOMB",
								fallback: "Let's send this now!",
								actions
							}
						]
					})
				} else {

				}
			})

		}


	}

	pingContainers.fromUser.forEach((pingContainer) => {
		const { ping, ping: { dataValues: { ToUser } }, session } = pingContainer;

		// if the toUser is about to have their session ended (which only happens when they have a session queued for you and not in superFocus), then we can skip this.

		if (session) {
			// if in session, give option to break focus
			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			// this is right, but there needs to be context here!! (what is the message);
			// i.e. I'll send your message below at that time, unless it's urgent and you want to send it now:
			// >>> Here is the message that will get queued!
			
			convo.say({
				text: ,
				
			});
		} else {
			// if not in session, trigger convo immediately
			convo.say(`<@${ToUser.dataValues.SlackUserId}> is not in a focused session, so I just started a conversation between you two :simple_smile:`);
		}
	});

}

