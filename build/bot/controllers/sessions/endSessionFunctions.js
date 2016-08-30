'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEndSessionFlow = startEndSessionFlow;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
function startEndSessionFlow(convo) {
	var _convo$sessionEnd = convo.sessionEnd;
	var SlackUserId = _convo$sessionEnd.SlackUserId;
	var UserId = _convo$sessionEnd.UserId;
	var session = _convo$sessionEnd.session;
	var tz = _convo$sessionEnd.tz;
	var endSessionType = _convo$sessionEnd.endSessionType;
	var pingContainers = _convo$sessionEnd.pingContainers;
	var pingInfo = _convo$sessionEnd.pingInfo;


	var startTimeObject = void 0;
	var endTimeObject = void 0;
	var endTimeString = void 0;
	var sessionMinutes = void 0;
	var sessionTimeString = void 0;
	var message = ' ';
	var letsFocusMessage = 'When you’re ready, let me know when you’d like to focus again';

	// add session info if existing
	if (session) {
		var _session$dataValues = session.dataValues;
		var content = _session$dataValues.content;
		var startTime = _session$dataValues.startTime;
		var endTime = _session$dataValues.endTime;

		startTimeObject = (0, _momentTimezone2.default)(startTime).tz(tz);
		endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
		endTimeString = endTimeObject.format("h:mm a");
		sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);
	}

	// if this flow is triggered by ended by ping ToUser, and the userId of this session matches with FromUser.UserId of ping
	if (endSessionType == _constants.constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {

		// send this only if there are LIVE pings remaining from this user => ToUser ping!

		// ended by someone else. user may or may not be in session

		var PingId = pingInfo.PingId;
		var FromUser = pingInfo.FromUser;
		var ToUser = pingInfo.ToUser;


		message = 'Hey! <@' + ToUser.dataValues.SlackName + '> just finished their session';
		if (pingInfo.endSessionType == _constants.constants.endSessionTypes.endSessionEarly) {
			message = message + ' early';
		}
		message = message + '\n:point_left: I just kicked off a conversation between you two';

		if (pingInfo.session) {
			letsFocusMessage = 'I ended your focused session on `' + session.dataValues.content + '`. ' + letsFocusMessage;
		}
	} else if (session) {
		// session must exist for all endSessionTypes other than endByPingToUserId
		message = 'Great work on `' + session.dataValues.content + '`! You were focused for *' + sessionTimeString + '*';
	}

	convo.say(message); // this message is relevant to how session got ended (ex. sessionTimerUp vs endByPingToUserId)
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage,
		attachments: _constants.letsFocusAttachments
	});

	convo.next();
}

// this handles messaging for all pings to user of ending session
function handleToUserPings(convo) {
	var _convo$sessionEnd2 = convo.sessionEnd;
	var SlackUserId = _convo$sessionEnd2.SlackUserId;
	var UserId = _convo$sessionEnd2.UserId;
	var session = _convo$sessionEnd2.session;
	var tz = _convo$sessionEnd2.tz;
	var endSessionType = _convo$sessionEnd2.endSessionType;
	var pingInfo = _convo$sessionEnd2.pingInfo;
	var pingContainers = _convo$sessionEnd2.pingContainers;

	var message = ' ';

	var slackUserIds = [];
	pingContainers.toUser.forEach(function (pingContainer) {
		var FromUser = pingContainer.ping.dataValues.FromUser;

		if (!_lodash2.default.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	});

	var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

	if (slackUserIds.length == 1) {
		message = 'While you were heads down, ' + slackNamesString + ' asked me to send you a message after your session :relieved:';
	} else if (slackUserIds.length > 1) {
		message = 'While you were heads down, you received messages from ' + slackNamesString;
	}

	convo.say(message);

	message = ' ';
	if (slackUserIds.length == 1) {
		message = ':point_left: I just kicked off a conversation between you both';
	} else if (slackUserIds.length > 1) {
		message = ':point_left: I just kicked off separate conversations between you and each of them';
	}

	convo.say(message);
	convo.next();
}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {
	var _convo$sessionEnd3 = convo.sessionEnd;
	var SlackUserId = _convo$sessionEnd3.SlackUserId;
	var UserId = _convo$sessionEnd3.UserId;
	var session = _convo$sessionEnd3.session;
	var tz = _convo$sessionEnd3.tz;
	var endSessionType = _convo$sessionEnd3.endSessionType;
	var pingInfo = _convo$sessionEnd3.pingInfo;
	var pingContainers = _convo$sessionEnd3.pingContainers;

	var message = void 0;

	// UserId is fromUserId because it is this user who is ending session

	for (var toUserId in pingContainers.fromUser.toUser) {

		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		// if not in superFocus session and they also have msg pinged for you,
		// then their session will end automatically so only one side needs to
		// handle it!
		if (pingContainers.fromUser.toUser[toUserId].session && !pingContainers.fromUser.toUser[toUserId].session.dataValues.superFocus && pingContainers.toUser.fromUser[UserId]) {
			continue;
		}

		var pingContainer = pingContainers.fromUser.toUser[toUserId];
	}

	pingContainers.fromUser.forEach(function (pingContainer) {
		var ping = pingContainer.ping;
		var ToUser = pingContainer.ping.dataValues.ToUser;
		var session = pingContainer.session;

		// if the toUser is about to have their session ended (which only happens when they have a session queued for you and not in superFocus), then we can skip this.

		if (session) {
			// if in session, give option to break focus
			var _session$dataValues2 = session.dataValues;
			var content = _session$dataValues2.content;
			var endTime = _session$dataValues2.endTime;

			var endTimeString = (0, _momentTimezone2.default)(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			// this is right, but there needs to be context here!! (what is the message);
			// i.e. I'll send your message below at that time, unless it's urgent and you want to send it now:
			// >>> Here is the message that will get queued!

			convo.say({
				text: '<@' + ToUser.dataValues.SlackUserId + '> is focusing on `' + content + '` until *' + endTimeString + '*. I\'ll send your message at that time, unless this is urgent and you want to send it now',
				attachments: [{
					attachment_type: 'default',
					callback_id: "SEND_BOMB",
					fallback: "Let's send this now!",
					actions: [{
						name: _constants.buttonValues.sendNow.name,
						text: "Send now :bomb:",
						value: '{"updatePing": true, "sendBomb": true, "PingId": "' + ping.dataValues.id + '"}',
						type: "button"
					}, {
						name: _constants.buttonValues.cancelPing.name,
						text: "Cancel ping :negative_squared_cross_mark:",
						value: '{"updatePing": true, "cancelPing": true, "PingId": "' + ping.dataValues.id + '"}',
						type: "button"
					}]
				}]
			});
		} else {
			// if not in session, trigger convo immediately
			convo.say('<@' + ToUser.dataValues.SlackUserId + '> is not in a focused session, so I just started a conversation between you two :simple_smile:');
		}
	});
}
//# sourceMappingURL=endSessionFunctions.js.map