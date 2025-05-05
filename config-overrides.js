// Project root: my-course-project/config-overrides.js
const webpack = require('webpack');

module.exports = function override(config) {
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        NODE_ENV: process.env.NODE_ENV || 'development',
        REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL'
      })
    })
  );
  return config;
};
