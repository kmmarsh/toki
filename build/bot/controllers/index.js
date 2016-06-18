'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.controller = exports.wit = undefined;
exports.customConfigBot = customConfigBot;
exports.connectOnInstall = connectOnInstall;
exports.connectOnLogin = connectOnLogin;

var _botkit = require('botkit');

var _botkit2 = _interopRequireDefault(_botkit);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _botkitMiddlewareWitai = require('botkit-middleware-witai');

var _botkitMiddlewareWitai2 = _interopRequireDefault(_botkitMiddlewareWitai);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _tasks = require('./tasks');

var _tasks2 = _interopRequireDefault(_tasks);

var _work_sessions = require('./work_sessions');

var _work_sessions2 = _interopRequireDefault(_work_sessions);

var _reminders = require('./reminders');

var _reminders2 = _interopRequireDefault(_reminders);

var _days = require('./days');

var _days2 = _interopRequireDefault(_days);

var _bot = require('../bot');

var _bot2 = _interopRequireDefault(_bot);

var _receiveMiddleware = require('../middleware/receiveMiddleware');

var _receiveMiddleware2 = _interopRequireDefault(_receiveMiddleware);

var _miscellaneousController = require('./miscellaneousController');

var _miscellaneousController2 = _interopRequireDefault(_miscellaneousController);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _intents = require('../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _initiation = require('../actions/initiation');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('dotenv').config();

// actions


// config modules


// Wit Brain
if (process.env.WIT_TOKEN) {

  console.log("Integrate Wit");
  var wit = (0, _botkitMiddlewareWitai2.default)({
    token: process.env.WIT_TOKEN,
    minimum_confidence: 0.55
  });
} else {
  console.log('Error: Specify WIT_TOKEN in environment');
  process.exit(1);
}

exports.wit = wit;

/**
 *      ***  CONFIG  ****
 */

var controller = _botkit2.default.slackbot();

exports.controller = controller;

// simple way to keep track of bots

var bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.PORT) {
  console.log('Error: Specify SLACK_ID SLACK_SECRET and PORT in environment');
  process.exit(1);
}

// Custom Navi Config
function customConfigBot(controller) {

  // beef up the bot
  (0, _bot2.default)(controller);
  (0, _receiveMiddleware2.default)(controller);

  // add controller functionalities
  (0, _days2.default)(controller);
  (0, _tasks2.default)(controller);
  (0, _work_sessions2.default)(controller);
  (0, _miscellaneousController2.default)(controller);
  (0, _reminders2.default)(controller);
}

// try to avoid repeat RTM's
function trackBot(bot) {
  bots[bot.config.token] = bot;
}

/**
 *      ***  TURN ON THE BOT  ****
 *         VIA SIGNUP OR LOGIN
 */

function connectOnInstall(team_config) {
  var bot = controller.spawn(team_config);
  controller.trigger('create_bot', [bot, team_config]);
}

function connectOnLogin(team_config) {
  var bot = controller.spawn(team_config);
  controller.trigger('login_bot', [bot, team_config]);
}

// upon install
controller.on('create_bot', function (bot, team) {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.");
  } else {
    bot.startRTM(function (err) {
      if (!err) {
        console.log("RTM on and listening");
        customConfigBot(controller);
        trackBot(bot);
        controller.saveTeam(team, function (err, id) {
          if (err) {
            console.log("Error saving team");
          } else {
            console.log("Team " + team.name + " saved");
          }
        });
        (0, _initiation.firstInstallInitiateConversation)(bot, team);
      } else {
        console.log("RTM failed");
      }
    });
  }
});

// subsequent logins
controller.on('login_bot', function (bot, team) {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.");
  } else {
    bot.startRTM(function (err) {
      if (!err) {
        console.log("RTM on and listening");
        customConfigBot(bot);
        trackBot(bot);
        controller.saveTeam(team, function (err, id) {
          if (err) {
            console.log("Error saving team");
          } else {
            console.log("Team " + team.name + " saved");
          }
        });
        (0, _initiation.loginInitiateConversation)(bot, team);
      } else {
        console.log("RTM failed");
        console.log(err);
      }
    });
  }
});

//DIALOG
controller.storage.teams.all(function (err, teams) {

  console.log(teams);

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t in teams) {
    if (teams[t].bot) {
      var bot = controller.spawn(teams[t]).startRTM(function (err) {
        if (err) {
          console.log('Error connecting bot to Slack:', err);
        } else {
          trackBot(bot);
        }
      });
    }
  }
});

/**
 *      CATCH ALL BUCKET FOR WIT INTENTS
 */

// this will send message if no other intent gets picked up
controller.hears([''], 'direct_message', wit.hears, function (bot, message) {

  console.log("\n\n\n ~~ in back up area ~~ \n\n\n");
  console.log(message);

  // this means that user said something that we cannot handle yet
  if (!message.selectedIntent) {
    bot.reply(message, "Hey! I can only help you with a few things. Here's the list of things I can help you with:");

    var options = ['start a session', 'end session early', 'set a reminder', 'view your task list', 'add a task to your list', 'end your day', 'return to session and forget this interaction ever occured'];
    var optionsList = "```";
    options.forEach(function (option) {
      optionsList = '' + optionsList + option + '\n';
    });
    optionsList = optionsList + '```';

    bot.reply(message, optionsList);
  }
});

/**
 *      CATCH FOR WHETHER WE SHOULD START
 *        A NEW SESSION GROUP (AKA A NEW DAY) OR NOT
 *    1) if have not started day yet, then this will get triggered
 *    2) if it has been 5 hours, then this will get this trigger
 */
controller.on('new_session_group_decision', function (bot, config) {

  // type is either `ADD_TASK` or `START_SESSION`
  var SlackUserId = config.SlackUserId;
  var intent = config.intent;


  _models2.default.User.find({
    where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
    include: [_models2.default.SlackUser]
  }).then(function (user) {

    var name = user.nickName || user.email;
    var UserId = user.id;

    // 1. has user started day yet?
    user.getSessionGroups({
      order: '"SessionGroup"."createdAt" DESC',
      limit: 1
    }).then(function (sessionGroups) {

      console.log("\n\n\n ~~ IN NEW SESSION GROUP DECISION ~~ \n\n\n");
      console.log("\n\n\n ~~ this is the dispatch center for many decisions ~~ \n\n\n");
      console.log("\n\n\n config object: \n\n\n");
      console.log(config);
      console.log("\n\n\n\n");

      // should start day and everything past this is irrelevant
      var shouldStartDay = false;
      if (sessionGroups.length == 0) {
        shouldStartDay = true;
      } else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
        shouldStartDay = true;
      }
      if (shouldStartDay) {
        bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
          convo.say("Wait, you have not started a day yet!");
          convo.next();
          convo.on('end', function (convo) {
            controller.trigger('user_confirm_new_day', [bot, { SlackUserId: SlackUserId }]);
          });
        });
        return;
      }

      // 2. you have already `started your day`, but it's been 5 hours since working with me
      var fiveHoursAgo = new Date((0, _momentTimezone2.default)().subtract(5, 'hours'));
      user.getWorkSessions({
        where: ['"WorkSession"."endTime" > ?', fiveHoursAgo]
      }).then(function (workSessions) {

        // you have had at least one work session in the last 5 hours
        if (workSessions.length > 0) {
          // you have had a recent work session and are ready to just get passed through
          switch (intent) {
            case _intents2.default.ADD_TASK:
              controller.trigger('add_task_flow', [bot, { SlackUserId: SlackUserId }]);
              break;
            case _intents2.default.START_SESSION:
              controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
              break;
            case _intents2.default.VIEW_TASKS:
              controller.trigger('view_daily_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
              break;
            case _intents2.default.END_DAY:
              controller.trigger('trigger_day_end', [bot, { SlackUserId: SlackUserId }]);
              break;
            default:
              break;
          }
          return;
        }

        bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

          convo.name = name;
          convo.newSessionGroup = {
            decision: false // for when you want to end early
          };

          convo.say('Hey ' + name + '! It\'s been a while since we worked together');
          convo.ask("If your priorities changed, I recommend that you `start your day` to kick the tires :car:, otherwise let's `continue`", function (response, convo) {

            var responseMessage = response.text;

            // 1. `start your day`
            // 2. `add a task`
            // 3. anything else will exit
            var startDay = new RegExp(/(((^st[tart]*))|(^d[ay]*))/); // `start` or `day`
            var letsContinue = new RegExp(/((^co[ntinue]*))/); // `add` or `task`

            if (startDay.test(responseMessage)) {
              // start new day
              convo.say("Got it. Let's do it! :weight_lifter:");
              convo.newSessionGroup.decision = _intents2.default.START_DAY;
            } else if (letsContinue.test(responseMessage)) {
              // continue with add task flow
              convo.say("Got it. Let's continue on :muscle:");
              convo.newSessionGroup.decision = intent;
            } else {
              // default is to exit this conversation entirely
              convo.say("Okay! I'll be here for whenever you're ready");
            }
            convo.next();
          });

          convo.on('end', function (convo) {

            console.log("end of start new session group");
            var newSessionGroup = convo.newSessionGroup;


            if (newSessionGroup.decision == _intents2.default.START_DAY) {
              controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
              return;
            } else {
              switch (intent) {
                case _intents2.default.ADD_TASK:
                  controller.trigger('add_task_flow', [bot, { SlackUserId: SlackUserId }]);
                  break;
                case _intents2.default.START_SESSION:
                  controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
                  break;
                case _intents2.default.VIEW_TASKS:
                  controller.trigger('view_daily_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
                  break;
                case _intents2.default.END_DAY:
                  controller.trigger('trigger_day_end', [bot, { SlackUserId: SlackUserId }]);
                  break;
                default:
                  break;
              }
            }
          });
        });
      });
    });
  });
});
//# sourceMappingURL=index.js.map