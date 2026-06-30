// Centralized logging via electron-log (file + console). The whole app imports this — never
// console.log. Logs land in ~/Library/Logs/Pocket Agent Capture/main.log.

import log from "electron-log/main";

log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "debug";

export default log;
