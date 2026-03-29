import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessageModel.js";
import Group from "./models/GroupModel.js";

const setupSocket = (server) => {
  console.log("Socket.io server started");

  const io = new SocketIOServer(server, {
    cors: {
      origin: [process.env.ORIGIN],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const disconnect = (socket) => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  };

  // ================= MESSAGE =================
  const sendMessage = async (message) => {
    const senderSocketId = userSocketMap.get(message.sender);
    const recipientSocketId = userSocketMap.get(message.recipient);

    const createdMessage = await Message.create({
      ...message,
      status: "sent", // initial status
    });

    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .populate("recipient", "id email firstName lastName image color");

    // send to receiver
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("receiveMessage", messageData);

      // update delivered
      await Message.findByIdAndUpdate(createdMessage._id, {
        status: "delivered",
      });

      // notify sender
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageStatusUpdate", {
          messageId: createdMessage._id,
          status: "delivered",
        });
      }
    }

    // send back to sender
    if (senderSocketId) {
      io.to(senderSocketId).emit("receiveMessage", messageData);
    }
  };

  // ================= SEEN =================
  const markMessageSeen = async ({ messageId, senderId }) => {
    await Message.findByIdAndUpdate(messageId, {
      status: "seen",
    });

    const senderSocketId = userSocketMap.get(senderId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageStatusUpdate", {
        messageId,
        status: "seen",
      });
    }
  };

  // ================= REACTIONS =================
  const addReaction = async ({ messageId, userId, emoji }) => {
    const message = await Message.findById(messageId);

    if (!message) return;

    message.reactions.push({ userId, emoji });
    await message.save();

    const senderSocketId = userSocketMap.get(message.sender.toString());
    const recipientSocketId = userSocketMap.get(
      message.recipient?.toString()
    );

    if (senderSocketId) {
      io.to(senderSocketId).emit("reactionUpdated", message);
    }

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("reactionUpdated", message);
    }
  };

  // ================= FRIEND REQUEST =================
  const sendFriendRequest = async (friendRequest) => {
    const recipientSocketId = userSocketMap.get(friendRequest.target._id);
    const senderSocketId = userSocketMap.get(friendRequest.friendRequest.id);

    if (recipientSocketId) {
      io.to(recipientSocketId).emit(
        "receiveFriendRequest",
        friendRequest.friendRequest
      );
    }
  };

  // ================= GROUP MESSAGE =================
  const sendGroupMessage = async (message) => {
    const { groupId, sender, content, messageType, fileUrl } = message;

    const createdMessage = await Message.create({
      sender,
      recipient: null,
      content,
      messageType,
      timestamp: new Date(),
      fileUrl,
      status: "sent",
    });

    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .exec();

    const lastMessageData = {
      content: messageData.content,
      messageType: messageData.messageType,
      timestamp: messageData.timestamp,
      fileUrl: messageData.fileUrl,
    };

    await Group.findByIdAndUpdate(groupId, {
      $push: { messages: createdMessage._id },
      $set: { lastMessage: lastMessageData },
    });

    const group = await Group.findById(groupId).populate("members");

    const finalData = {
      ...messageData._doc,
      groupId: group._id,
      group: group,
    };

    if (group && group.members) {
      group.members.forEach((member) => {
        const memberSocketId = userSocketMap.get(member._id.toString());
        if (memberSocketId) {
          io.to(memberSocketId).emit("receiveGroupMessage", finalData);
        }
      });
    }
  };

  // ================= GROUP CREATION =================
  const createGroup = async (group) => {
    if (group && group.members) {
      group.members.forEach((member) => {
        const memberSocketId = userSocketMap.get(member);
        if (memberSocketId) {
          io.to(memberSocketId).emit("receiveGroupCreation", group);
        }
      });
    }
  };

  // ================= CONNECTION =================
  io.on("connection", (socket) => {
    console.log(`Socket ${socket.id} connected.`);
    const userId = socket.handshake.query.userId;

    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`User connected: ${userId}`);
    }

    socket.on("sendMessage", sendMessage);
    socket.on("sendFriendRequest", sendFriendRequest);
    socket.on("sendGroupMessage", sendGroupMessage);
    socket.on("createGroup", createGroup);

    // NEW EVENTS
    socket.on("markMessageSeen", markMessageSeen);
    socket.on("addReaction", addReaction);

    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;