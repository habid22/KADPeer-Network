let netLib = require("net");
let ptpMessage = require("./KADPTP");
let uniqueInstance = require("./Singleton");

// ---------------------------- Exports -----------------------------------------
module.exports = {
  /**
   * Handles the initial connection process when a new client joins the Kademlia network.
   * This includes setting up the client's peer information and interactions 
   * with the server's Distributed Hash Table (DHT).
   *
   * @param {net.Socket} connection - The socket representing the client's connection.
   * @param {Object} dhtTable - The server's Kademlia DHT.
   */
  handleClientJoining: handleClientJoining, 

  /**
   * Manages ongoing communications and events for a connected client within the 
   * Kademlia network. This might handle data exchange, peer discovery, and potentially 
   * DHT updates triggered by client actions.
   *
   * @param {net.Socket} socket - The socket representing the client's connection.
   * @param {string} name - The name or identifier of the client.
   * @param {Object} dht - The Kademlia DHT.
   */
  handleCommunications: handleCommunications 
};

// ---------------------------------------------------------------------
function handleClientJoining(connection, dhtTable) {  // Entry point for new client joining
  /**
   * Initiates the process of integrating a newly connected client into the Kademlia network.
   *  Delegates the handling of the connection and DHT interactions to the 
   * `processServerPeerConnection` function.
   * 
   * @param {net.Socket} connection - The socket representing the client's connection.
   * @param {Object} dhtTable - The server's Kademlia Distributed Hash Table.
   */
  processServerPeerConnection(connection, dhtTable);
}

// ---------------------------------------------------------------------

function handleCommunications(socket, name, dht) {  // Once the client is connected and integrated into the network
  /**
   * Manages ongoing communications for a connected Kademlia client. 
   * involves handling network events (data received, connection closed, etc.) and 
   * facilitating interactions with the Kademlia network. It delegates these tasks 
   * to the `handleClientNetworkEvents` function.
   *
   * @param {net.Socket} socket -  The socket representing the client's connection.
   * @param {string} name -  The name or identifier of the client.
   * @param {Object} dht -  The Kademlia Distributed Hash Table (likely the server's).
   */
  handleClientNetworkEvents(socket, name, dht);
}

// ---------------------------------------------------------------------

function processServerPeerConnection(connection, dhtTable) { 
  /**
   * Handles the process of establishing and managing a connection with another Kademlia peer 
   * on the server side. includes generating a peer ID, parsing messages, and 
   * modifying the server's (DHT).
   *
   * @param {net.Socket} connection - The socket representing the connection to the peer.
   * @param {Object} dhtTable - The server's Kademlia Distributed Hash Table.
   */

  // --- Peer Information Generation ---
  function createJoiningPeer(connection) {
    /**
     * Creates a basic peer information object for a newly connecting peer. It extracts 
     * the IP address and port from the connection and uses the `uniqueInstance` 
     * module to calculate a unique `peerID`. 
     *
     * @param {net.Socket} connection - The socket representing the connection to the peer.
     * @returns {Object} An object containing peerName, peerIP, peerPort, and peerID
     */
    const peerID = uniqueInstance.getPeerID(connection.remoteAddress, connection.remotePort);
    return {
      peerName: "", 
      peerIP: connection.remoteAddress,
      peerPort: connection.remotePort,
      peerID: peerID
    };
  }

  // --- Internal State ---
  let packet = null; // Stores the parsed message from the peer
  let joiningPeer = createJoiningPeer(connection); // Creates initial peer information

  // --- Event Handlers ---
  connection.on('data', handleData); // Data event handler for incoming messages 
  connection.on('end', handleEnd); // End event handler for connection closure

  function handleData(data) {
    /**
     * Event handler for the 'data' event. Parses the incoming message data 
     * 
     *
     * @param {Buffer} data -  The raw data received from the peer.
     */
    packet = parseMessage(data);
  }

  function handleEnd() {
    /**
     * Event handler for the 'end' event (connection closed). Performs actions based on 
     * whether a message has been received from the peer:
     *   * If a 'hello' message (msgType == 2) was received, processes it with `handleHelloMessage`.
     *   * Otherwise, logs the connection and adds the new peer to the DHT.
     */
    if (packet) {
      if (packet.msgType == 2) {
        handleHelloMessage(packet, dhtTable, joiningPeer); 
      }
    } else { 
      console.log(" "); // Formatting
      console.log("Connected from peer " + joiningPeer.peerIP + ":" + joiningPeer.peerPort + "\n");
      pushBucket(dhtTable, joiningPeer); 
    }
  }

  // --- Initial Hello Message ---
  if (packet == null) {
    /**
     * If no message has been received initially, the server sends a 'hello' message to 
     * the peer, likely to initiate discovery and exchange DHT information.
     */
    sendHelloMessage(connection, dhtTable);
  }
}
// ---------------------------------------------------------------------

function handleHelloMessage(packet, dhtTable, joiningPeer) {
  /**
   * Processes an incoming 'hello' message from a peer. This includes updating the peer's name, 
   * logging the message, and potentially integrating the peer and its shared DHT information
   * into the server's Kademlia Distributed Hash Table.
   * 
   * @param {Object} packet - The parsed 'hello' message.
   * @param {Object} dhtTable - The server's Kademlia Distributed Hash Table (DHT).
   * @param {Object} joiningPeer - The peer information object for the peer that sent the message.
   */

  // Display the current state of the Server's DHT
  displayServerDHT(dhtTable); 

  // Update the peer's name based on the 'hello' message 
  joiningPeer.peerName = packet.senderName;

  // Build a detailed log message
  let message = "Received Hello Message from " + joiningPeer.peerName + " [" + joiningPeer.peerID + "] ";

  // Include details about any shared DHT information
  if (packet.peersList.length > 0) {
    let details = "along with DHT ";
    for (var i = 0; i < packet.peersList.length; i++) {
      details += "[" + packet.peersList[i].peerIP + ":" +
                 packet.peersList[i].peerPort + ", " +
                 packet.peersList[i].peerID +
                 "] \n";
    }
    message += details;
  }
  console.log(message); 

  // Check if the peer already exists in the DHT
  let exists = dhtTable.table.find(e => e.node.peerPort == joiningPeer.peerPort); 
  if (exists) {
    // Update the existing peer's name
    exists.node.peerName = joiningPeer.peerName; 
  } else {
    // Add the new peer to the DHT
    pushBucket(dhtTable, joiningPeer); 
  }

  // Determine the appropriate K-bucket prefix 
  let bucketPrefix = exists ? exists.prefix : uniqueInstance.getBucketPrefix(dhtTable.owner.peerID, joiningPeer.peerID);

  // Placeholder for bucket overflow logic (assuming `isBucketFull` is a separate function)
  if (isBucketFull) { 
    console.log(`Bucket P${bucketPrefix} is full, checking if we need to change the stored value`);
    console.log("Current value is closest, no update needed \n");
  } else {
    console.log(`Bucket P${bucketPrefix} is not full, adding ${joiningPeer.peerID}`);
    console.log(" "); // Formatting
  }

  // Update the server's DHT with any shared peer information
  updateDHTtable(dhtTable, packet.peersList); 
}
// ---------------------------------------------------------------------

function isBucketFull(DHTtable, prefix) { 
  /**
   * Checks if a specific K-bucket in the server's DHT is full.
   *
   * @param {Object} DHTtable - The server's Kademlia Distributed Hash Table.
   * @param {number} prefix - The numeric prefix identifying the K-bucket. 
   * @returns {boolean} True if the bucket is full, otherwise false. 
   */

  let bucketSize = 31; // Maximum number of entries allowed in a bucket 
  let bucketCount = DHTtable.table.filter(e => e.prefix === prefix).length; 
  // Counts the entries in the DHT with the specified prefix 
   
  return bucketCount >= bucketSize; // Returns true if the count reaches the size limit
}
// ---------------------------------------------------------------------

function sendHelloMessage(connection, dhtTable) {
  /**
   * Constructs and sends a 'hello' message to a connected peer. Which uses the `ptpMessage` 
   * module to format the message and sends it over the connection.
   * 
   * @param {net.Socket} connection - The socket connection to the peer.
   * @param {Object} dhtTable - The server's Kademlia Distributed Hash Table.
   */

  ptpMessage.init(9, 1, dhtTable); // Initializes the PTP message (type 9, msg type (1), and includes DHT information)
  connection.write(ptpMessage.getPacket()); // Sends the formatted message 
  connection.end(); // Closes the connection
}
// ---------------------------------------------------------------------

function handleClientNetworkEvents(socket, name, dht) {
  /**
   * Manages network events for a client connection. Sets up handlers for the 'data' 
   * (message received) and 'end' (connection closed) events.
   *
   * @param {net.Socket} socket -  The socket connection to the client.
   * @param {string} name - The name or identifier of the client.
   * @param {Object} dht - The Kademlia Distributed Hash Table (likely the server's).
   */

  socket.on('data', (data) => handleDataReceived(socket, data, name, dht));
  socket.on('end', () => handleConnectionEnd(dht)); 
}
// ---------------------------------------------------------------------


function handleDataReceived(socket, data, name, dht) {
  /**
   * Handles incoming data from a client. Parses the message, identifies the sender,
   * and processes the message based on its type.
   *
   * @param {net.Socket} socket -  The socket connection of the client.
   * @param {Buffer} data - The raw message data.
   * @param {string} name - The name or identifier of the client.
   * @param {Object} dht - The Kademlia Distributed Hash Table (likely the server's).
   */

  const packet = parseMessage(data); 
  const sender = createSenderPeer(socket, packet); 

  if (packet.msgType == 1) { 
    // Assuming message type 1 is a connection initiation
    logConnectionDetails(socket, sender, name);
    initializeServerPeer(socket, name, dht); 
    processWelcomeMessage(sender, packet, dht); 
  } else {
    console.log("The message type " + packet.msgType + " is not supported");
  }
}
// ---------------------------------------------------------------------

function createSenderPeer(socket, packet) {
  /**
   * Creates a peer information object representing the sender of a message.  It extracts
   * the IP address, port, and sender name (from the packet) and uses the `uniqueInstance` 
   * module to calculate a unique peer ID.
   * 
   * @param {net.Socket} socket - The socket connection of the sender.
   * @param {Object} packet - The parsed message received from the sender.
   * @returns {Object} An object containing peerName, peerIP, peerPort, and peerID.
   */

  const senderID = uniqueInstance.getPeerID(socket.remoteAddress, socket.remotePort);
  return {
    peerName: packet.senderName, 
    peerIP: socket.remoteAddress,
    peerPort: socket.remotePort,
    peerID: senderID
  };
}
// ---------------------------------------------------------------------

function logConnectionDetails(socket, sender, name) { 
  /** 
   * Logs connection details to the console. Includes information about the connected peer, 
   * the local peer (server endpoint), timestamp, and their unique peer IDs.
   *
   * @param {net.Socket} socket -  The socket connection of the client.
   * @param {Object} sender - The sender peer information object.
   * @param {string} name - The name or identifier of the local peer (likely the server).
   */

  console.log(`Connected to ${sender.peerName}:${socket.remotePort} at timestamp: ${uniqueInstance.getTimestamp()}\n`);
  const localPeerID = uniqueInstance.getPeerID(socket.localAddress, socket.localPort);
  console.log(`This peer address is ${socket.localAddress}:${socket.localPort} located at ${name} [${localPeerID}]\n`); 
}
// ---------------------------------------------------------------------

function initializeServerPeer(socket, name, dht) {
  /**
   * The initializeServerPeer function transforms the local node into a server in a Kademlia-based network, allowing it to handle incoming peer connections.
   *
   * @param {net.Socket} socket - The socket connection of the client.
   * @param {string} name - The name or identifier of the local peer
   * @param {Object} dht -  The Kademlia Distributed Hash Table
   */

  const server = netLib.createServer(); 
  server.listen(socket.localPort, socket.localAddress); 
  server.on("connection", (sock) => processServerPeerConnection(sock, dht)); 
}
// ---------------------------------------------------------------------

function processWelcomeMessage(sender, packet, dht) { 
  /**
   * Processes a 'welcome' message received from a server peer. This includes logging the 
   * message, updating the local DHT with the sender's information, and potentially 
   * incorporating any shared DHT information from the message.
   *
   * @param {Object} sender - The sender peer information object.
   * @param {Object} packet - The parsed 'welcome' message.
   * @param {Object} dht - The local peer's Kademlia Distributed Hash Table.
   */

  console.log(`Received Welcome message from server [${sender.peerID}]` + 
    (packet.peersList.length > 0 ? ` along with DHT: ${packet.peersList.map(peer => `[${peer.peerIP}:${peer.peerPort}, ${peer.peerID}]`).join(", ")}` : " along with DHT: []"));
  updateOrAddPeerToDHT(sender, dht);
  updateDHTtable(dht, packet.peersList);
}
// ---------------------------------------------------------------------

function updateOrAddPeerToDHT(sender, dht) {  // Update or add a peer to the DHT
  /**
   * Attempts to add a peer to the Distributed Hash Table (DHT), or updates the peer's
   * information in the DHT if it already exists. 
   *
   * @param {Object} sender - The peer information object to add or update.
   * @param {Object} dht - The Kademlia Distributed Hash Table. 
   */

  // Check if the peer exists based on its port number
  let exists = dht.table.find(e => e.node.peerPort == sender.peerPort); 

  if (!exists) {
    /** 
     * If the peer doesn't exist:
     *    - Calls the `pushBucket` function to add the peer to the appropriate K-bucket 
     *      in the DHT. 
     */
    pushBucket(dht, sender);
  } else {
    /**
     * If the peer already exists:
     *    - Logs a message indicating the peer's presence. 
     *    - Note: You might want to add logic here to update the peer's information
     *      (e.g., last seen timestamp) if necessary.
     */
    console.log(`${sender.peerPort} already exists in the DHT.`);
  }
}
// ---------------------------------------------------------------------

function handleConnectionEnd(dht) { 
  /**
   * Event handler for the 'end' event (connection closed). This function logs 
   * the disconnection and triggers any necessary actions based on the connection closure.
   *
   * @param {Object} dht - The Kademlia Distributed Hash Table.
   */
  sendHello(dht);
}
// ----------------------------Bucket Functions--------------------------------------

function refreshBucket(DHTtable, peersList) {
  /**
   * Updates a K-bucket or potentially multiple buckets within the DHT, as part 
   * of a refresh operation to ensure the DHT contains up-to-date peer information.
   *
   * @param {Object} DHTtable - The Kademlia Distributed Hash Table. 
   * @param {Array} peersList - An array of peer objects containing peer information.
   */
 
  peersList.forEach(peer => {
    /**
     * Iterates through each peer in the `peersList` and uses the `pushBucket` function
     * to either:
     *   1. Add the peer to the appropriate K-bucket in the DHT if it's a new peer.
     *   2. Update the peer's information or position in the DHT if it already exists.
     */
    pushBucket(DHTtable, peer);

  });
}
// ---------------------------------------------------------------------

function updateDHTtable(DHTtable, list) { 
  /**
   * Updates the Kademlia Distributed Hash Table (DHT),by incorporating a list 
   * of new or updated peers. This also includes displaying the updated DHT to the console.
   *
   * @param {Object} DHTtable - The Kademlia Distributed Hash Table. 
   * @param {Array} list -  A list of peer information objects.
   */

  refreshBucket(DHTtable, list); // Updates DHT buckets with the provided peer list
  displayDHT(DHTtable); // Displays the updated DHT in the console
}
// ---------------------------------------------------------------------

function displayDHT(DHTtable) {
  /**
   * Displays the current state of the Kademlia Distributed Hash Table (DHT) in the console.
   *
   * @param {Object} DHTtable - The Kademlia Distributed Hash Table to display.
   */
  console.log("Refresh k-Bucket operation is performed.\n");

  if (DHTtable.table.length > 0) {
    let output = "My DHT: ";
    for (var j = 0; j < DHTtable.table.length; j++) {
      output +=
        "[P" +
        DHTtable.table[j].prefix + ", " +
        DHTtable.table[j].node.peerIP + ":" +
        DHTtable.table[j].node.peerPort + ", " +
        DHTtable.table[j].node.peerID +
        "]\n        ";
    }
    console.log(output);
  }
}

// ---------------------------------------------------------------------
function displayServerDHT(serverDHTtable) {
  /**
   * Displays the current state of the server's Kademlia Distributed Hash Table (DHT) in the console.
   *
   * @param {Object} serverDHTtable - The server's Kademlia Distributed Hash Table to display.
   */
  if (serverDHTtable.table.length > 0) {
    let output = "My DHT: ";
    for (var j = 0; j < serverDHTtable.table.length; j++) {
      output +=
        "[P" +
        serverDHTtable.table[j].prefix + ", " +
        serverDHTtable.table[j].node.peerIP + ":" +
        serverDHTtable.table[j].node.peerPort + ", " +
        serverDHTtable.table[j].node.peerID +
        "] ";
    }
    console.log(output);
  }
}
// ---------------------------------------------------------------------

function sendHello(DHTtable) {
  let i = 0;  // Initialize a counter to iterate through the DHT entries

  // Define a function to send a hello message to a single peer
  function sendHelloToPeer() {
    // Delay the execution to avoid flooding the network or overwhelming the node
    setTimeout(() => {
      // Check if there are more peers in the DHT to process
      if (i < DHTtable.table.length) {
        // Create a new socket for the connection
        let sock = new netLib.Socket();

        // Establish a connection to the current peer in the DHT
        sock.connect({
          port: DHTtable.table[i].node.peerPort, // The peer's port
          host: DHTtable.table[i].node.peerIP,   // The peer's IP address
          localPort: DHTtable.owner.peerPort     // The local port from which to establish the connection
        }, () => {
          // Initialize and send a PTP (Peer-to-Peer) message once the connection is established
          ptpMessage.init(9, 2, DHTtable);
          sock.write(ptpMessage.getPacket());

          // Close and destroy the socket shortly after sending the message
          setTimeout(() => {
            sock.end();
            sock.destroy();
          }, 200);
        });

        // Once the socket is closed, increment the counter and attempt to send the next hello message
        sock.on('close', () => {
          i++;
          sendHelloToPeer();
        });
      }

      // Log when the process has sent hello messages to all peers in the DHT
      if (i === DHTtable.table.length - 1) {
        console.log("Hello packet has been sent.\n");
      }
    }, 200); // Set a delay of 200 milliseconds before sending the next hello message
  }

  // Start sending hello messages, beginning with the first peer in the DHT
  sendHelloToPeer();
}


// ---------------------------------------------------------------------

function pushBucket(DHT, peerInfo) {
  /**
   * Attempts to add a peer to the appropriate K-bucket within a Kademlia Distributed Hash Table 
   * (DHT). Maintains K-bucket logic, including bucket size limitations and peer replacement.
   * 
   * @param {Object} DHT - The Kademlia Distributed Hash Table.
   * @param {Object} peerInfo -  Information about the peer to potentially add. 
   */
  if (DHT.owner.peerID !== peerInfo.peerID) { // Prevents the node from adding itself to its own DHT
    let localBinaryID = uniqueInstance.Hex2Bin(DHT.owner.peerID); // Convert the owner's peer ID to binary
    let peerBinaryID = uniqueInstance.Hex2Bin(peerInfo.peerID); // Convert the peer's ID to binary
    let bucketIndex = 0; // Initialize the bucket index

    // Calculate K-Bucket Prefix (index)
    for (bucketIndex = 0; bucketIndex < localBinaryID.length; bucketIndex++) { // Iterate over the binary ID
      if (localBinaryID[bucketIndex] !== peerBinaryID[bucketIndex]) { // Compare the bits
        break; // Stop when the first differing bit is found
      }
    }

    let newBucketEntry = { // Create a new entry for the bucket
      prefix: bucketIndex,  // Bucket index
      node: peerInfo     // Peer information
    };

    // Check if a peer with the same prefix already exists
    let existingEntry = DHT.table.find(entry => entry.prefix === bucketIndex); // Find an existing entry in the bucket

    if (existingEntry) { // If an entry exists
      // Distance-Based Replacement Logic        
      let existingPeerDistance = uniqueInstance.XORing(localBinaryID, uniqueInstance.Hex2Bin(existingEntry.node.peerID)); // Calculate the distance of the existing peer
      let newPeerDistance = uniqueInstance.XORing(localBinaryID, peerBinaryID); // Calculate the distance of the new peer

      if (newPeerDistance < existingPeerDistance) { // Compare the distances
        // Replace if the new peer is 'closer'
        DHT.table = DHT.table.filter(entry => entry.node.peerID !== existingEntry.node.peerID);  // Remove the existing peer
        DHT.table.push(newBucketEntry);
        console.log(`Peer ${peerInfo.peerID} replaces peer ${existingEntry.node.peerID} in bucket P${bucketIndex}`); // Log the replacement
      } else {
        console.log(`Peer ${peerInfo.peerID} is not added to bucket P${bucketIndex}. Peer ${existingEntry.node.peerID} is closer.`); // Log the decision
      }

    } else {
      // Adding to a Non-Full Bucket
      if (DHT.table.length < 32) { // Assuming a maximum bucket size of 32
        DHT.table.push(newBucketEntry); // Add the new peer to the bucket
        console.log(`Bucket P${bucketIndex} has no value, adding ${peerInfo.peerID} \n`);  // Log the addition
      } else { // If the bucket is full
        console.log("DHT table is full. Cannot add more entries."); // Log that the DHT is full
      }
    }
  } else {
    // console.log(`Peer ${peerInfo.peerID} is the owner. Not adding to bucket.`);
  }
}


// -----------------------------Parsing Functions----------------------------------------

function parseMessage(data) {
  /**
   * Parses a raw message buffer (likely received over the network) in accordance with a 
   * custom protocol and extracts relevant data into a structured object. 
   *
   * @param {Buffer} data -  The raw message data.
   * @returns {Object} A parsed packet object containing version, message type, sender name, 
   *                   and a list of included peers (if any).
   */

  let parsedPacket = {};  // Initialize the parsed packet object
  let peerList = [];  // Initialize an array to store peer information
  let bitIndex = 0;  // Initialize the bit index for parsing

  // Parse Version (4 bits)
  parsedPacket.version = parseBitPacket(data, bitIndex, 4);  // Parse the version
  bitIndex += 4;  // Increment the bit index

  // Parse Message Type (7 bits)
  parsedPacket.msgType = parseBitPacket(data, bitIndex, 7);  // Parse the message type
  bitIndex += 7;  // Increment the bit index

  // Parse Number of Peers (9 bits)
  let numPeers = parseBitPacket(data, bitIndex, 9);  // Parse the number of peers
  bitIndex += 9;  // Increment the bit index

  // Parse Sender Name Size (12 bits)
  let nameSize = parseBitPacket(data, bitIndex, 12); // Parse the sender name size
  bitIndex += 12;    // Increment the bit index

  // Extract Sender Name 
  let byteIndex = Math.ceil(bitIndex / 8); // Calculate starting byte index
  parsedPacket.senderName = bytes2string(data.slice(byteIndex, byteIndex + nameSize)); 
  byteIndex += nameSize; 
  bitIndex = byteIndex * 8; // Update bitIndex to the next aligned byte

  // Parse Peers List
  if (numPeers > 0) { // If there are peers in the message
    for (let i = 0; i < numPeers; i++) { // Iterate over the number of peers
      let ipSegments = [];

      // Parse IP Address
      for (let j = 0; j < 4; j++) {  // Parse the IP address
        ipSegments.push(parseBitPacket(data, bitIndex, 8));  // Parse each segment
        bitIndex += 8; 
      }

      // Parse Port
      let port = parseBitPacket(data, bitIndex, 16); // Parse the port
      bitIndex += 16; 

      // Create Peer Information Object
      let peerIP = ipSegments.join('.'); // Combine IP segments
      let peerID = uniqueInstance.getPeerID(peerIP, port); // Generate a peer ID
      let peerInfo = { // Create a peer information object
        peerIP: peerIP, // IP address
        peerPort: port, // Port number
        peerID: peerID // Peer ID
      };

      peerList.push(peerInfo); 
    }
  }

  // Assemble Parsed Packet
  parsedPacket.peersList = peerList; 
  return parsedPacket; 
}

// ---------------------------------------------------------------------

function bytes2string(array) { 
  let result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}
// ---------------------------------------------------------------------

function parseBitPacket(packet, offset, length) {
  let number = 0;
  for (var i = 0; i < length; i++) {
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) & 1;
    number = (number << 1) | bit;
  }
  return number;
}

// ---------------------------------------------------------------------
