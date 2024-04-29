const net = require("net");
const singleton = require("./Singleton");
const handler = require("./KADNetworkManager");

// Initialize singleton
singleton.init();

// Get current folder name
const myName = __dirname.split("\\").pop();

// Set localhost IP address
const HOST = "127.0.0.1";

// Get random port number
const PORT = singleton.getPort();

// Generate server ID
const serverID = singleton.getPeerID(HOST, PORT);

// Handle command line arguments
if (process.argv.length <= 2 || process.argv[2] !== "-n") {
  console.error("Invalid arguments. Usage: node KADpeer -n peerName -p serverIP:port");
  process.exit(1);
}

const args = process.argv.slice(2);
const peerName = args[1];

if (peerName === "server") {
  // Run as server
  runServer();
} else {
  // Run as client
  runClient(peerName, args);
}

// Function to run as server
function runServer() {
  const serverSocket = net.createServer();
  serverSocket.listen(PORT, HOST);
  console.log(`Server is running at ${HOST}:${PORT}, located at ${myName} [${serverID}]`);

  const serverPeer = { peerName: myName, peerIP: HOST, peerPort: PORT, peerID: serverID };
  const serverDHTtable = { owner: serverPeer, table: [] };

  serverSocket.on("connection", sock => {
    handler.handleClientJoining(sock, serverDHTtable);
  });
}

// Function to run as client
function runClient(peerName, args) {
  if (args.length !== 4 || args[2] !== "-p") {
    console.error("Invalid arguments. Usage: node KADpeer -n peerName -p serverIP:port");
    process.exit(1);
  }

  const [_, __, flag, address] = args;
  if (flag !== "-p") {
    console.error("Invalid arguments. Usage: node KADpeer -n peerName -p serverIP:port");
    process.exit(1);
  }

  const [knownHOST, knownPORT] = address.split(":");
  const clientSocket = new net.Socket();
  const clientPort = singleton.getPort();

  clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: clientPort }, () => {
    const clientID = singleton.getPeerID(clientSocket.localAddress, clientPort);
    const clientPeer = { peerName, peerIP: clientSocket.localAddress, peerPort: clientPort, peerID: clientID };
    const clientDHTtable = { owner: clientPeer, table: [] };

    handler.handleCommunications(clientSocket, peerName, clientDHTtable);
  });
}
