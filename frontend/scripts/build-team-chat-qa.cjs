const path = require("node:path");
const webpack = require("webpack");

webpack({
  mode: "development", devtool: false,
  context: path.resolve(__dirname, ".."),
  entry: path.join(__dirname, "team-chat-qa-entry.jsx"),
  output: { path: path.resolve(__dirname, "../../scratch/team-chat-qa"), filename: "app.js" },
  resolve: { extensions: [".js", ".jsx"], modules: [path.resolve(__dirname, "../node_modules"), "node_modules"] },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve("babel-loader"), options: { babelrc: false, configFile: false, presets: [[require.resolve("@babel/preset-react"), { runtime: "automatic" }]] } } },
    { test: /\.css$/, use: [require.resolve("style-loader"), require.resolve("css-loader")] },
  ] },
  plugins: [new webpack.DefinePlugin({ "process.env.REACT_APP_API_URL": "window.location.origin", "process.env.REACT_APP_SOCKET_URL": "window.location.origin", "process.env.REACT_APP_MARKETING_URL": '""' })],
  optimization: { minimize: false }, performance: { hints: false },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; }
  else console.log("PASS: focused Team Inbox browser bundle compiled from current source");
});
