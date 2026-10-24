import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`ig-automatic-tools escutando em http://${config.host}:${config.port}`);
});
