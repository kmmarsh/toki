'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   queryInterface.addColumn(
      'StoredWorkSessions',
      'resumed',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('WorkSessions', 'resumed');

  }
};
