'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   queryInterface.addColumn(
      'Reminders',
      'open',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Reminders', 'open');

  }
};
