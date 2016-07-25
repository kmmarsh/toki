import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';
import { witTimeResponseToTimeZoneObject, witDurationToTimeZoneObject, dateStringToMomentTimeZone } from '../../lib/miscHelpers';
import { convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

/**
 * 		Sometimes there is a need for just NL functionality not related
 * 		to Wit and Wit intents. Put those instances here, since they will
 * 		show up before Wit gets a chance to pick them up first.
 */

export default function(controller) {

	// intentionally pausing session
	controller.hears(['pa[ause]{1,}'], 'direct_message', (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			let config = { SlackUserId };
			controller.trigger(`session_pause_flow`, [bot, config]);

		}, 1000);

	});

	// intentionally resuming session
	controller.hears(['re[esume]{3,}'], 'direct_message', (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			let config = { SlackUserId };
			controller.trigger(`session_resume_flow`, [bot, config]);

		}, 1000);

	});

}