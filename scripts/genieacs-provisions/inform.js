// ============================================================
// Provision: inform - Universal Inform Handler for GenieACS
// Configured for ERP_NET Dynamic Inform Interval Control
// ============================================================

// Device ID as username
const username = declare("DeviceID.ID", {value: 1}).value[0];

// Password fixed for a given device because Math.random is seeded by DeviceID
const password = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);

// Refresh values daily
const daily = Date.now(86400000);

// Unique inform offset per device for better load distribution
const informTime = daily % 86400000;

// TR-098 data model
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestUsername", {value: daily}, {value: username});
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestPassword", {value: daily}, {value: password});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: daily}, {value: true});
// NOTE: We do NOT force a static interval here so ERP_NET can control it dynamically!
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: daily});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformTime", {value: daily}, {value: informTime});

// TR-181 data model
declare("Device.ManagementServer.ConnectionRequestUsername", {value: daily}, {value: username});
declare("Device.ManagementServer.ConnectionRequestPassword", {value: daily}, {value: password});
declare("Device.ManagementServer.PeriodicInformEnable", {value: daily}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: daily});
declare("Device.ManagementServer.PeriodicInformTime", {value: daily}, {value: informTime});
