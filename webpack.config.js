var webpack = require('webpack');
  module.exports = {
    entry: [
      'webpack-dev-server/client?http://localhost:8080',
      'webpack/hot/only-dev-server',
      './src/index.jsx'
    ],
    module: {
      loaders: [{
        test: /.jsx?$/,
        exclude: /node_modules/,
        loaders: ['react-hot-loader', 'babel-loader']

      }, {
        test: /.css$/,
        loader: 'style-loader'
      }, {
        test: /.css$/,
        loader: 'css-loader',
        query: {
  	  modules: true,
	  localIdentName: '[name]__[local]___[hash:base64:5]'
        }
      }]
    },
    resolve: {
      extensions: ['.js', '.jsx']
    },
    output: {
      path: __dirname + '/dist',
      publicPath: '/',
      filename: 'bundle.js'
    },
    devtool: 'eval-source-map',
    devServer: {
      hot: true,
      contentBase: './dist'
    },
    plugins: [
      new webpack.HotModuleReplacementPlugin()
    ]
  };
