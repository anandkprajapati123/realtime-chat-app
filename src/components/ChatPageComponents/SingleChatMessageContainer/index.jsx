import { useEffect, useRef, useState } from "react";
import "./SingleChatMessageContainer.css";
import { useAppStore } from "../../../store";
import { apiClient } from "../../../lib/api-client";
import {
  GET_ALL_MESSAGES_ROUTE,
  GET_GROUP_MESSAGES_ROUTE,
} from "../../../utils/constants";
import moment from "moment";
import { MdChatBubble, MdFolderZip } from "react-icons/md";
import { IoMdArrowRoundDown } from "react-icons/io";
import { PiClockFill } from "react-icons/pi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import ScrollToBottom from "../ScrollToBottom/scrollToBottom";
import { useSocket } from "../../../context/SocketContext.jsx";

const SingleChatMessageContainer = () => {
  const messageContainerRef = useRef();
  const scrollRef = useRef();

  const socket = useSocket();

  const {
    selectedChatType,
    selectedChatData,
    userInfo,
    selectedChatMessages,
    setSelectedChatMessages,
  } = useAppStore();

  // ================= FETCH MESSAGES =================
  useEffect(() => {
    const getMessages = async () => {
      const res = await apiClient.post(
        GET_ALL_MESSAGES_ROUTE,
        { id: selectedChatData._id },
        { withCredentials: true }
      );
      if (res.data.messages) setSelectedChatMessages(res.data.messages);
    };

    const getGroupMessages = async () => {
      const res = await apiClient.get(
        `${GET_GROUP_MESSAGES_ROUTE}/${selectedChatData._id}`,
        { withCredentials: true }
      );
      if (res.data.messages) setSelectedChatMessages(res.data.messages);
    };

    if (selectedChatData._id) {
      selectedChatType === "contact"
        ? getMessages()
        : getGroupMessages();
    }
  }, [selectedChatData, selectedChatType]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "auto" });
  }, [selectedChatMessages]);

  // ================= REACTION =================
  const handleAddReaction = (messageId) => {
    const emoji = prompt("Enter emoji 👍 ❤️ 😂");
    if (!emoji || !socket) return;

    socket.emit("addReaction", {
      messageId,
      userId: userInfo.id,
      emoji,
    });
  };

  // ================= HELPERS =================
  const checkIfImage = (filePath) =>
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filePath.split("?")[0]);

  const handleDownload = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.click();
  };

  // ================= RENDER DM =================
  const renderDMMessages = (message) => {
    const isOwn = message.sender !== selectedChatData._id;

    return (
      <div
        key={message._id}
        className={`message ${isOwn ? "own-message" : "contact-message"}`}
      >
        <div
          onDoubleClick={() => handleAddReaction(message._id)}
          className={`message-content ${
            isOwn ? "own-message-content" : "contact-message-content"
          }`}
        >
          <MdChatBubble className="user-pointer-icon" />

          {message.messageType === "text" && message.content}

          {message.messageType === "file" && message.fileUrl && (
            <div>
              {checkIfImage(message.fileUrl) ? (
                <img src={message.fileUrl} width={200} />
              ) : (
                <div>
                  <MdFolderZip />
                  <span>{message.fileUrl.split("/").pop()}</span>
                  <IoMdArrowRoundDown
                    onClick={() => handleDownload(message.fileUrl)}
                  />
                </div>
              )}
            </div>
          )}

          {/*  REACTIONS */}
          {message.reactions?.length > 0 && (
            <div className="reactions-container">
              {message.reactions.map((r, i) => (
                <span key={i}>{r.emoji}</span>
              ))}
            </div>
          )}

          {/*  TIMESTAMP + STATUS */}
          <div className="message-timestamp">
            {moment(message.timestamp).format("LT")}

            {isOwn && (
              <span style={{ marginLeft: 5 }}>
                {message.status === "sent" && <BsCheck />}
                {message.status === "delivered" && <BsCheckAll />}
                {message.status === "seen" && (
                  <BsCheckAll style={{ color: "#4fc3f7" }} />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ================= MAIN =================
  return (
    <div className="message-container" ref={messageContainerRef}>
      {selectedChatMessages.map((msg) =>
        selectedChatType === "contact"
          ? renderDMMessages(msg)
          : renderDMMessages(msg)
      )}

      <div ref={scrollRef} />
      <ScrollToBottom
        containerRef={messageContainerRef}
        targetRef={scrollRef}
      />
    </div>
  );
};

export default SingleChatMessageContainer;