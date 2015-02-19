var _ = require('lodash');
var native = require('./build/Release/clang.node');

module.exports = _.reduce(native, function(agg, prop, key) {
  if (key.indexOf('clang_') === 0) {
    agg[key.substr(6)] = prop;
  }
  else {
    agg[key] = prop;
  }
  return agg;
}, {});
