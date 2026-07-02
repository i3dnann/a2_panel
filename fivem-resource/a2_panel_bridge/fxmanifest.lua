fx_version "cerulean"
game "gta5"

author "A2 Panel"
description "A2 Panel FiveM bridge for live players, reports, and admin actions"
version "1.0.0"

lua54 "yes"

shared_scripts {
  "config.lua"
}

server_scripts {
  "server.lua"
}

client_scripts {
  "client.lua"
}
