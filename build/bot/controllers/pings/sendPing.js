'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *		Enter ping flow via Wit
  */
	controller.hears(['ping'], 'direct_message', _index.wit.hears, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		controller.trigger('ping_flow', [bot, message]);
	});

	/**
  * 		ACTUAL PING FLOW
  * 		this will begin the ping flow with user
  */
	controller.on('ping_flow', function (bot, message) {
		var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
		var _message$intentObject = message.intentObject.entities;
		var intent = _message$intentObject.intent;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;
		var datetime = _message$intentObject.datetime;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;

		var pingSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

		var pingMessages = [];
		if (pingSlackUserIds) {
			// this replaces up to "ping <@UIFSMIOM>"
			var pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/, "").trim();
			if (pingMessage) {
				pingMessages.push(pingMessage);
			}
		}

		// allow customization
		if (config) {
			if (config.pingMessages) {
				pingMessages = config.pingMessages;
			}
			if (config.pingSlackUserIds) {
				pingSlackUserIds = config.pingSlackUserIds;
			}
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			_models2.default.User.find({
				where: { SlackUserId: SlackUserId }
			}).then(function (user) {
				var tz = user.tz;

				var UserId = user.id;

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					// have 5-minute exit time limit
					if (convo) convo.task.timeLimit = 1000 * 60 * 5;

					convo.pingObject = {
						SlackUserId: SlackUserId,
						UserId: UserId,
						bot: bot,
						tz: tz,
						pingSlackUserIds: pingSlackUserIds,
						pingMessages: pingMessages
					};

					(0, _pingFunctions.confirmTimeZoneExistsThenStartPingFlow)(convo);

					convo.on('end', function (convo) {
						var _convo$pingObject = convo.pingObject;
						var SlackUserId = _convo$pingObject.SlackUserId;
						var tz = _convo$pingObject.tz;
						var pingUserId = _convo$pingObject.pingUserId;
						var pingSlackUserId = _convo$pingObject.pingSlackUserId;
						var pingTimeObject = _convo$pingObject.pingTimeObject;
						var userInSession = _convo$pingObject.userInSession;
						var deliveryType = _convo$pingObject.deliveryType;
						var pingMessages = _convo$pingObject.pingMessages;
						var neverMind = _convo$pingObject.neverMind;


						if (neverMind) // do not send if this is the cas!
							return;

						var fromUserConfig = { UserId: UserId, SlackUserId: SlackUserId };
						var toUserConfig = { UserId: pingUserId, SlackUserId: pingSlackUserId };
						var config = { userInSession: userInSession, deliveryType: deliveryType, pingTimeObject: pingTimeObject, pingMessages: pingMessages };

						(0, _pingFunctions.queuePing)(bot, fromUserConfig, toUserConfig, config);
					});
				});
			});
		}, 250);
	});

	/**
  * 		BOMB THE PING MESSAGE FUNCTIONALITY (via button)
  */
	controller.on('update_ping_message', function (bot, config) {
		var PingId = config.PingId;
		var sendBomb = config.sendBomb;
		var cancelPing = config.cancelPing;


		_models2.default.Ping.find({
			where: { id: PingId },
			include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage]
		}).then(function (ping) {

			// this is a `bomb` to ToUser
			var _ping$dataValues = ping.dataValues;
			var FromUser = _ping$dataValues.FromUser;
			var ToUser = _ping$dataValues.ToUser;
			var tz = FromUser.dataValues.tz;


			bot.startPrivateConversation({ user: FromUser.dataValues.SlackUserId }, function (err, convo) {

				if (sendBomb) {
					convo.say(':point_left: Got it! I just kicked off a conversation between you and <@' + ToUser.dataValues.SlackUserId + '> for that ping');
				} else if (cancelPing) {
					convo.say('That ping to <@' + ToUser.dataValues.SlackUserId + '> has been canceled!');
				}

				convo.on('end', function (convo) {

					if (sendBomb) {
						_models2.default.Ping.update({
							live: true,
							deliveryType: _constants.constants.pingDeliveryTypes.bomb
						}, {
							where: { id: PingId }
						});
					} else if (cancelPing) {
						_models2.default.Ping.update({
							live: false
						}, {
							where: { id: PingId }
						});
					}
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

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _pingFunctions = require('./pingFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=sendPing.js.map