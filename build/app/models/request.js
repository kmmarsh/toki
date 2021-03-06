'use strict';

module.exports = function (sequelize, DataTypes) {
  var Request = sequelize.define('Request', {
    FromUserId: DataTypes.INTEGER,
    ToUserId: DataTypes.INTEGER,
    content: DataTypes.STRING,
    type: { type: DataTypes.STRING,
      defaultValue: "live"
    }
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return Request;
};
//# sourceMappingURL=request.js.map