// MessageCard.tsx
import React from 'react';
import moment from 'moment';
import { Timestamp } from 'firebase/firestore';

// Define the types for the props
interface Message {
  id: string;
  senderId: string;
  content: string;
  time: Timestamp;
  image?: string;
}

interface User {
  id: string;
  profileImage: string;
}

interface MessageCardProps {
  message: Message;
  me: User;
  other: User;
}

function MessageCard( {message, me, other} : MessageCardProps) {
    const isMessageFromMe = message.senderId === me.id;

    const formatTimeAgo = (time: Timestamp) => {
      const date = time?.toDate();
      const momentDate = moment(date);
      return momentDate.fromNow();
    };

    // Major change: w-10 h-10 -> flex items-start
    return (
      <div key={message.id} className={`flex mb-4 ${isMessageFromMe ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar on the left or right based on the sender */}
        <div className={`flex items-start ${isMessageFromMe ? 'ml-2 mr-2' : 'mr-2'}`}>
        {
          !isMessageFromMe && (
            <img
              className='w-10 h-10 rounded-full overflow-hidden'
              src={other.profileImage}
              alt='Avatar'
            />
          )
        }
        {
          isMessageFromMe && (
            <img
              className='w-10 h-10 rounded-full overflow-hidden'
              src={me.profileImage}
              alt='Avatar'
            />
          )
        }
        {/*
          <img
            className="w-10 h-10 object-cover rounded-full"
            src={message.avatarUrl}
            alt="Avatar"
          />
        */}

          {/* Edit this to change output of messages*/}
          {/* Message bubble on the right or left based on the sender, think ml-3 look good enough change color here */}
          <div className={`text-white p-2 rounded-md ${isMessageFromMe ? 'bg-blue-500 self-end ml-3' : 'bg-gray-400 self-start ml-3'}`}>
            {
              message.image && <img src={message.image} className='max-h-60 w-60 mb-4' />
            }
            <p>{message.content}</p>
            <div className="text-xs text-gray-200">{formatTimeAgo(message.time)}</div>
          </div>
        </div>
      </div>
    );
  }
  
  export default MessageCard;