import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAppStore } from "../store";
import { HOST } from "../utils/constants";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const socket = useRef();
  const { userInfo } = useAppStore();

  useEffect(() => {
    if (userInfo) {
      socket.current = io(HOST, {
        withCredentials: true,
        query: { userId: userInfo.id },
      });

      socket.current.on("connect", () => {
        console.log("Connected to socket server");
      });

      // ================= MESSAGE STATUS =================
      const handleMessageStatusUpdate = ({ messageId, status }) => {
        const { updateMessageStatus } = useAppStore.getState();
        updateMessageStatus(messageId, status);
      };

      // ================= REACTIONS =================
      const handleReactionUpdated = (updatedMessage) => {
        const { updateMessageReactions } = useAppStore.getState();
        updateMessageReactions(updatedMessage);
      };

      // ================= RECEIVE MESSAGE =================
      const handleReceiveMessage = (message) => {
        const {
          selectedChatData,
          selectedChatType,
          addMessage,
          addContactsInDMContacts,
        } = useAppStore.getState();

        if (
          selectedChatType !== undefined &&
          (selectedChatData._id === message.sender._id ||
            selectedChatData._id === message.recipient._id)
        ) {
          addMessage(message);

          // mark as seen ONLY if message is from other user
          if (
            socket.current &&
            message.sender._id !== userInfo.id
          ) {
            socket.current.emit("markMessageSeen", {
              messageId: message._id,
              senderId: message.sender._id,
            });
          }
        }

        addContactsInDMContacts(message);
      };

      // ================= GROUP MESSAGE =================
      const handleReceiveGroupMessage = (message) => {
        const {
          selectedChatData,
          selectedChatType,
          addMessage,
          sortGroupList,
        } = useAppStore.getState();

        if (
          selectedChatType !== undefined &&
          selectedChatData._id === message.groupId
        ) {
          addMessage(message);
        }

        sortGroupList(message.group);
      };

      // ================= GROUP CREATION =================
      const handleReceiveGroupCreation = (group) => {
        const { addGroup } = useAppStore.getState();
        addGroup(group);
      };

      // ================= FRIEND REQUEST =================
      const handleReceiveFriendRequest = (friendRequest) => {
        const {
          friendRequests,
          setFriendRequests,
          setFriendRequestsCount,
        } = useAppStore.getState();

        const formattedFriendRequest = {
          email: friendRequest.email,
          firstName: friendRequest.firstName,
          lastName: friendRequest.lastName,
          image: friendRequest.image,
        };

        const requestExists = friendRequests.some(
          (req) => req.email === formattedFriendRequest.email
        );

        if (!requestExists) {
          setFriendRequestsCount(friendRequests.length + 1);
          setFriendRequests([formattedFriendRequest, ...friendRequests]);
        }
      };

      // ================= SOCKET LISTENERS =================
      socket.current.on("receiveMessage", handleReceiveMessage);
      socket.current.on("receiveGroupCreation", handleReceiveGroupCreation);
      socket.current.on("receiveGroupMessage", handleReceiveGroupMessage);
      socket.current.on("receiveFriendRequest", handleReceiveFriendRequest);

      socket.current.on("messageStatusUpdate", handleMessageStatusUpdate);
      socket.current.on("reactionUpdated", handleReactionUpdated);

      // ================= CLEANUP =================
      return () => {
        socket.current.off("receiveMessage", handleReceiveMessage);
        socket.current.off(
          "receiveGroupCreation",
          handleReceiveGroupCreation
        );
        socket.current.off(
          "receiveGroupMessage",
          handleReceiveGroupMessage
        );
        socket.current.off(
          "receiveFriendRequest",
          handleReceiveFriendRequest
        );

        // NEW CLEANUP
        socket.current.off(
          "messageStatusUpdate",
          handleMessageStatusUpdate
        );
        socket.current.off("reactionUpdated", handleReactionUpdated);

        socket.current.disconnect();
      };
    }
  }, [userInfo?.id]);

  return (
    <SocketContext.Provider value={socket.current}>
      {children}
    </SocketContext.Provider>
  );
};