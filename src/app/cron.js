import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import _ from 'lodash';
import { colorsHash } from '../bot/lib/constants';

// the cron file!
export default function() {

	if (bots) {
		// cron job functions go here
		checkForSessions()
		checkForPings()
	}

}

let checkForPings = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	let now       = moment();
	let nowString = now.format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	models.Ping.findAll({
		where: [ `"Ping"."live" = ? AND "Ping"."deliveryType" != ?`, true, "sessionEnd" ],
		order: `"Ping"."createdAt" DESC`
	}).then((pings) => {

		pings.forEach((ping) => {

			const { FromUserId, ToUserId, deliveryType, pingTime } = ping;

			// if there's a pingTime, respect it and dont send yet!
			if (pingTime) {
				let pingTimeObject = moment(pingTime);
				if (pingTimeObject > now) {
					return;
				}
			}

			ping.getPingMessages({})
			.then((pingMessages) => {
				models.User.find({
					where: { id: FromUserId }
				})
				.then((fromUser) => {

					const fromUserTeamId = fromUser.TeamId;

					models.User.find({
						where: { id: ToUserId }
					})
					.then((toUser) => {

						const toUserTeamId = toUser.TeamId;

						if (fromUserTeamId != toUserTeamId) {
							// ERROR ERROR -- this should never happen!
							return;
						}

						ping.update({
							live: false
						});

						let SlackUserIds = `${fromUser.dataValues.SlackUserId},${toUser.dataValues.SlackUserId}`;

						models.Team.find({
							where: { TeamId: fromUserTeamId }
						})
						.then((team) => {
							const { token } = team;
							let bot = bots[token];
							if (bot) {

								bot.api.mpim.open({
									users: SlackUserIds
								}, (err, response) => {
									if (!err) {

										const { group: { id } } = response;
										bot.startConversation({ channel: id }, (err, convo) => {
											let initialMessage = `Hey <@${toUser.dataValues.SlackUserId}>! <@${fromUser.dataValues.SlackUserId}> wanted to reach out`;
											switch (deliveryType) {
												case "bomb":
													initialMessage = `Hey <@${toUser.dataValues.SlackUserId}>! <@${fromUser.dataValues.SlackUserId}> has an urgent message for you:`;
													break;
												case "grenade":
													initialMessage = `Hey <@${toUser.dataValues.SlackUserId}>! <@${fromUser.dataValues.SlackUserId}> has an urgent message for you:`;
													break;
												default: break;
											}

											initialMessage = `*${initialMessage}*`;
											let attachments = [];

											pingMessages.forEach((pingMessage) => {
												attachments.push({
													text: pingMessage.content,
													mrkdwn_in: ["text"],
													attachment_type: 'default',
													callback_id: "PING_MESSAGE",
													fallback: pingMessage.content,
													color: colorsHash.toki_purple.hex
												});
											});

											convo.say({
												text: initialMessage,
												attachments
											});

										})
									}
								});

							}
						});

					})
				});
			})

		});
	});

}

let checkForSessions = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	let now = moment().format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	models.Session.findAll({
		where: [ `"Session"."endTime" < ? AND "Session"."live" = ? AND "Session"."open" = ?`, now, true, true ],
		order: `"Session"."createdAt" DESC`
	}).then((sessions) => {

		let accountedForUserIds = []; // ensure no double-counts

		sessions.forEach((session) => {

			const { UserId, open, live } = session;

			session.update({
				live: false,
				open: false
			})
			.then((session) => {

				// only trigger session if not accounted for yet
				if (!_.includes(accountedForUserIds, UserId)) {
					accountedForUserIds.push(UserId);
					models.User.find({
						where: { id: UserId }
					})
					.then((user) => {
						const { SlackUserId, TeamId } = user;

						let config = {
							SlackUserId,
							session
						}

						models.Team.find({
							where: { TeamId }
						})
						.then((team) => {
							const { token } = team;
							let bot = bots[token];
							if (bot) {
								// alarm is up for session
								const sessionTimerUp  = true;
								config.sessionTimerUp = sessionTimerUp
								controller.trigger(`end_session_flow`, [bot, { SlackUserId, sessionTimerUp }]);
							}
						});
					})
				}

			});
		});
	});
}