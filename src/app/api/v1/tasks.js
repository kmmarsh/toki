import request from 'request';
import express from 'express';
import pg from 'pg';

import moment from 'moment';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';

// sequelize models
import models from '../../models';

/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', (req, res) => {

  // models.DailyTask.create({
  //   TaskId:98,
  //   priority: 1,
  //   minutes: 99,
  //   UserId: 1
  // }).then((dailyTask) => {

    

  //   res.json(dailyTask);
  // })

  models.DailyTask.find({
    where: { id: 115 }
  }).then((dailyTask) => {
    console.log("daily task time from DB... should be in UTC w/ offset");
    var time = moment(dailyTask.createdAt).toString();
    console.log(time);

    

    console.log("UTC TIME:");
    console.log(moment.utc("2016-06-24 22:34:55.935").tz("America/Indiana/Indianapolis").toString())
    res.json(dailyTask);
  })


  // this lets me test creating daily tasks on server

  // const data = {
  //   text: "test task name",
  //   minutes: 50,
  //   priority: 1,
  //   UserId: 1
  // }

  // models.Task.create({
  //   text: data.text,
  //   UserId: data.UserId
  // }).then((task) => {
  //   models.DailyTask.create({
  //     TaskId: task.id,
  //     priority: data.priority,
  //     minutes: data.minutes
  //   });
  // });

  // models.DailyTask.findAll({
  //   include: [
  //     models.Task
  //   ]
  // }).then((dailyTasks) => {
  //   res.json(dailyTasks);
  // });

  // models.Task.findAll({}).then((tasks) => {
  //   res.json(tasks);
  // })

});

// create
router.post('/', (req, res) => {

  // grab data from API request
  // done is defaulted to false w/ new tasks
  const { text, user_id } = req.body;

  // THIS IS A PASSING TEST FOR SEPARATION OF CONCERNS
  // We get the data we need from DB, then can trigger the controller to send the appropriate message to the appropriate person

  // userID for kevin
  // var userID = "U121ZK15J"; // DM ID: "D1F93BHM3"
  // controller.trigger('test_message_send', [bot, userID, `Here is your task: ${data.text}`]);

  models.Task.create({
    text: text,
    UserId: user_id
  }).then((task) => {
    res.json(task);
  })

});

// read
router.get('/:id', (req, res) => {
  const { id } = req.params;
  models.Task.find({
    where: {
      id
    }
  }).then((task) => {
    res.json(task);
  })
});

// update
router.put('/:id', (req, res) => {

  const { title, done } = req.body;
  const { id } = req.params;

  models.Task.find({
    where: {
      id
    }
  }).then((task) => {
    if (task) {
      task.updateAttributes( {
        title,
        done
      }).then((task) => {
        res.send(task);
      })
    }
  })

});

// delete
router.delete('/:id', (req, res) => {

  const { id } = req.params;

  models.Task.destroy({
    where: {
      id
    }
  }).then((task) => {
    res.json(task);
  })

});;

export default router;