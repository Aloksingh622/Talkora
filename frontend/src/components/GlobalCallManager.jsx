import React, { useEffect, useState } from 'react';
import { getSocket } from '../utils/socket';
import IncomingCallModal from './IncomingCallModal';
import DMCall from './DMCall';
import { useSelector } from 'react-redux';

const GlobalCallManager = () => {
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const socket = getSocket();
    const currentUser = useSelector(state => state.auth.user);

    useEffect(() => {
        if (!socket || !currentUser) return;

        const handleIncomingCall = (data) => {
            console.log('[GlobalCallManager] INCOMING_CALL received:', data);
            // Verify it's for us (even though personal room should ensure that)
            // and we are not already in a call
            if (activeCall) {
                // Busy? Maybe emit BUSY signal?
                return;
            }
            setIncomingCall(data);
        };

        const handleCallAnswered = (data) => {
            // If someone else answered (multi-device?) or we answered elsewhere
            setIncomingCall(null);
        };

        const handleCallDeclined = (data) => {
            setIncomingCall(null);
        };

        const handleCallEnded = (data) => {
            setIncomingCall(null);
            setActiveCall(null);
        };

        socket.on('INCOMING_CALL', handleIncomingCall);
        socket.on('CALL_ANSWERED', handleCallAnswered);
        socket.on('CALL_DECLINED', handleCallDeclined);
        socket.on('CALL_ENDED', handleCallEnded);

        return () => {
            socket.off('INCOMING_CALL', handleIncomingCall);
            socket.off('CALL_ANSWERED', handleCallAnswered);
            socket.off('CALL_DECLINED', handleCallDeclined);
            socket.off('CALL_ENDED', handleCallEnded);
        };
    }, [socket, currentUser, activeCall]);

    const handleAnswerCall = () => {
        if (socket && incomingCall) {
            socket.emit('ANSWER_CALL', { channelId: incomingCall.channelId }, (ack) => {
                if (ack?.success) {
                    setActiveCall({ 
                        type: incomingCall.callType, 
                        channelId: incomingCall.channelId,
                        otherUser: incomingCall.from 
                    });
                    setIncomingCall(null);
                }
            });
        }
    };

    const handleDeclineCall = () => {
        if (socket && incomingCall) {
            socket.emit('DECLINE_CALL', { channelId: incomingCall.channelId });
            setIncomingCall(null);
        }
    };

    const handleEndCall = () => {
        if (socket && activeCall) {
            socket.emit('END_CALL', { channelId: activeCall.channelId });
            setActiveCall(null);
        }
    };

    return (
        <>
            {incomingCall && (
                <IncomingCallModal
                    caller={incomingCall.from}
                    callType={incomingCall.callType}
                    onAnswer={handleAnswerCall}
                    onDecline={handleDeclineCall}
                />
            )}
            {activeCall && (
                <DMCall
                    channelId={activeCall.channelId}
                    callType={activeCall.type}
                    otherUser={activeCall.otherUser}
                    onEnd={handleEndCall}
                />
            )}
        </>
    );
};

export default GlobalCallManager;
