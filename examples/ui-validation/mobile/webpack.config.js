const webpack = require('@nativescript/webpack');
module.exports = env => { if (env.android) env.commonjs = true; webpack.init(env); return webpack.resolveConfig(); };
