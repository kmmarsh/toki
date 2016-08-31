import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments, letsFocusAttachments, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, commaSeparateOutStringArray, stringifyNumber, getPingMessageContentAsAttachment, getHandleQueuedPingActions } from '../../lib/messageHelpers';

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

	// add session info (the one that just got ended) if existing
	// this is not the case when you have queued ping
	// and other user is done w/ session
	if (session) {
		const { dataValues: { content, startTime, endTime } } = session;
		startTimeObject   = moment(startTime).tz(tz);
		endTimeObject     = moment(endTime).tz(tz);
		endTimeString     = endTimeObject.format("h:mm a");
		sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = convertMinutesToHoursString(sessionMinutes);
	}

	// if this flow is triggered by `endByPingToUserId`, and the userId of this session matches with FromUser.UserId of ping
	if (endSessionType == constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {
		
		const { FromUser, ToUser } = pingInfo;

		message = `Hey! <@${ToUser.dataValues.SlackName}> finished their session`;
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

	convo.say(message);
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
	
	let slackUserIds = [];
	for (let fromUserId in pingContainers.toUser.fromUser) {
		
		if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
			continue;
		}

		const pingContainer = pingContainers.toUser.fromUser[fromUserId];
		const FromUser      = pingContainer.user;

		// do not include the user who ended session together
		if (pingInfo && pingInfo.thisPingEndedUsersSessionsTogether && pingInfo.SlackUserId == FromUser.dataValues.SlackUserId) {
			continue;
		}

		if (!_.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	}

	if (slackUserIds.length > 0) {

		let message;

		let slackNamesString = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

		if (slackUserIds.length == 1) {
			message = `While you were heads down, ${slackNamesString} asked me to send you a message after your session :relieved:\n:point_left: I just kicked off a conversation between you both`
		} else { // > 1
			message = `While you were heads down, you received messages from ${slackNamesString}\n:point_left: I just kicked off separate conversations between you and each of them`;
		}

		convo.say(message);

	}

	convo.next();

}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingContainers }  = convo.sessionEnd;
	let message;

	// `UserId` == `fromUserId` because it is this user who is ending session
	for (let toUserId in pingContainers.fromUser.toUser) {
		
		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		const pingContainer = pingContainers.fromUser.toUser[toUserId];

		// if ToUser from this user is not in a superFocus session and they also have msg pinged for you,
		// then their session will end automatically (so no need to handle it here)
		if ((!pingContainer.session || pingContainer.session && !pingContainer.session.dataValues.superFocus) && pingContainers.toUser.fromUser[toUserId]) {
			pingContainer.thisPingEndedUsersSessionsTogether = true;
			pingContainers.fromUser.toUser[toUserId]         = pingContainer;
			continue;
		}

		const { session, pings } = pingContainer;
		const ToUser             = pingContainer.user;

		if (session) {

			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			let sessionMessage = `<@${ToUser.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*.`;

			// separation when only queued 1 ping vs many pings
			if (pings.length == 1) {
				sessionMessage = `${sessionMessage}  I'll send your ping then, unless this is urgent and you want to send it now`;
				let actions = [
					{
						name: buttonValues.sendNow.name,
						text: "Send now :bomb:",
						value: `{"updatePing": true, "sendBomb": true, "PingId": "${pings[0].dataValues.id}"}`,
						type: "button"
					},
					{
						name: buttonValues.cancelPing.name,
						text: "Cancel ping :negative_squared_cross_mark:",
						value: `{"updatePing": true, "cancelPing": true, "PingId": "${pings[0].dataValues.id}"}`,
						type: "button"
					}
				];
				convo.say({
					text: sessionMessage,
					actions
				})
			} else {
				// if > 1 pings queued, only 1 session message and then send content out for each ping
				sessionMessage = `${sessionMessage}  I'll send your pings then, unless you think it's urgent and you want to send it now`;
				convo.say(sessionMessage);

				pings.forEach((ping, index) => {

					const numberString = stringifyNumber(index + 1);

					let attachments = getPingMessageContentAsAttachment(ping);
					let actions     = getHandleQueuedPingActions(ping);
					attachments.push({
						attachment_type: 'default',
						callback_id: "HANDLE_QUEUED_PING_TO_USER",
						fallback: `What do you want to do with this ping?`,
						actions
					});

					convo.say({
						text: `*Here's your ${numberString} ping:*`,
						attachments
					})
				});

			}

		} else {
			convo.say(`<@${ToUser.dataValues.SlackUserId}> is not in a focused session, so I just started a conversation between you two :simple_smile:`);
		}

	}

}

