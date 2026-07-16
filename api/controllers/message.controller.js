import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import { createNotification } from "../services/notificationService.js";
import { emitToConversation, emitToUser } from "../socket/index.js";

export const createMessage = async (req, res, next) => {
  const newMessage = new Message({
    conversationId: req.body.conversationId,
    userId: req.userId,
    desc: req.body.desc,
  });

  try {
    const savedMessage = await newMessage.save();
    const conversation = await Conversation.findOneAndUpdate(
      { id: req.body.conversationId },
      {
        $set: {
          readBySeller: req.isSeller,
          readByBuyer: !req.isSeller,
          lastMessage: req.body.desc,
        },
      },
      { new: true }
    );

    const payload = {
      message: savedMessage,
      conversationId: req.body.conversationId,
      conversation: conversation
        ? {
            id: conversation.id,
            lastMessage: conversation.lastMessage,
            readBySeller: conversation.readBySeller,
            readByBuyer: conversation.readByBuyer,
          }
        : null,
    };

    // Realtime: conversation room + recipient user room
    emitToConversation(req.body.conversationId, "message:new", payload);

    if (conversation) {
      const recipientId = req.isSeller
        ? conversation.buyerId
        : conversation.sellerId;
      const preview =
        typeof req.body.desc === "string" && req.body.desc.length > 80
          ? `${req.body.desc.slice(0, 80)}…`
          : req.body.desc || "New message";

      if (recipientId && String(recipientId) !== String(req.userId)) {
        emitToUser(recipientId, "message:new", payload);

        await createNotification({
          userId: recipientId,
          type: "new_message",
          message: `New message: ${preview}`,
          link: `/messages/${conversation.id}`,
        });
      }
    }

    res.status(201).send(savedMessage);
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ conversationId: req.params.id });
    res.status(200).send(messages);
  } catch (err) {
    next(err);
  }
};
