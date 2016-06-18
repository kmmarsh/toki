'use strict';
console.log("in index of sequelize models");

// env configuration 
import dotenv from 'dotenv';
dotenv.load();

console.log("enviroment vaariables:");
console.log(process.env);

var fs        = require('fs');
var path      = require('path');
var Sequelize = require('sequelize');
var basename  = path.basename(module.filename);
var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/../../../config.json')[env];
var db        = {};

// this is to handle PG inserts
// var pg = require('pg');
// var timestampOID = 1114;
// pg.types.setTypeParser(1114, function(stringValue) {
//   console.log("STRING VALUES!!\n\n\n\n\n");
//   console.log(stringValue);
//   return new Date(Date.parse(stringValue + "+0000"));
// });

console.log("using sequelize here");
console.log(config);
if (config.use_env_variable) {
  var sequelize = new Sequelize(process.env[config.use_env_variable]);
} else {
  var sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(function(file) {
    var model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
