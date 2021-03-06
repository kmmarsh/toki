// modules 
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';

// CronJob
import cron from 'cron';
import cronFunction from './app/cron';

// Global helpers (i.e. Prototype methods) 
import './app/globalHelpers';

let CronJob = cron.CronJob;

let app = express();

// configuration 
dotenv.load();

// public folder for images, css,...
app.use('/assets', express.static(`${__dirname}/public`));

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

// include bootstrap and jQuery
app.use('/js', express.static(`${__dirname}/../node_modules/bootstrap/dist/js`));
app.use('/js', express.static(`${__dirname}/../node_modules/jquery/dist`));
app.use('/css', express.static(`${__dirname}/../node_modules/bootstrap/dist/css`));
app.use('/fonts', express.static(`${__dirname}/../node_modules/bootstrap/dist/fonts`));

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/router').default((app));

// Error Handling
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
});

let env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	console.log("\n\n ~~ In development server of Toki ~~ \n\n");
  process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;

}

/**
 * 			START THE SERVER + BOT
 */
// ===================================================

// botkit
import { controller, customConfigBot, trackBot } from './bot/controllers';

customConfigBot(controller);

controller.configureSlackApp({
	clientId: process.env.SLACK_ID,
	clientSecret: process.env.SLACK_SECRET,
	scopes: ['bot', 'commands', 'channels:history']
})
controller.createWebhookEndpoints(app);
controller.createOauthEndpoints(app,function(err,req,res) {
  if (err) {
    res.status(500).send('ERROR: ' + err);
  } else {
    res.send('Success!');
  }
});

// create HTTP service
http.createServer(app).listen(process.env.HTTP_PORT, () => {
	console.log(`\n\n ~~Listening on port: ${app.get('port')}~~ \n\n`);

	 /**
	 * 						*** CRON JOB ***
	 * @param  time increment in cron format
	 * @param  function to run each increment
	 * @param  function to run at end of cron job
	 * @param  timezone of the job
	 */
	new CronJob('*/5 * * * * *', cronFunction, null, true, "America/New_York");

	// add bot to each team
	let teamTokens = [];
	controller.storage.teams.all((err, teams) => {
		if (err) {
			throw new Error(err);
		}

		// connect all the teams with bots up to slack
		for (let t in teams) {
			if (teams[t]) {
				teamTokens.push(teams[t].token);
			}
		}

		/**
		 * 		~~ START UP ZE BOTS ~~
		 */
		teamTokens.forEach((token, index) => {
			let bot = controller.spawn({ token, retry: 500 }).startRTM((err, bot, payload) => {

				if (err) {
					console.log(`\n\n'Error connecting to slack... :' ${err}`);
				} else {
					trackBot(bot); // this is where we store all ze started bots
				}

			})
		});
	});
});


