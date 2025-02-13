// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp,
    setDoc,
    doc,
    where,
    getDocs,
    updateDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAxDmW6dbfN3pEJQkltCn_jq2YGGbMRqhA",
    authDomain: "whatsapp-8fcfe.firebaseapp.com",
    projectId: "whatsapp-8fcfe",
    storageBucket: "whatsapp-8fcfe.appspot.com",
    messagingSenderId: "254784334711",
    appId: "1:254784334711:web:b927837e290bccaa694f72",
    measurementId: "G-GEESEBDRWW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let selectedUser = null;
let isSignUp = false;
let typingTimeout;

// Export functions to window object
const toggleAuthMode = () => {
    isSignUp = !isSignUp;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('authSwitchText');
    const switchBtn = document.getElementById('authSwitchBtn');
    const signupFields = document.getElementById('signupFields');

    title.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    switchText.textContent = isSignUp ? 'Already have an account? ' : "Don't have an account? ";
    switchBtn.textContent = isSignUp ? 'Sign In' : 'Sign Up';
    signupFields.style.display = isSignUp ? 'block' : 'none';
};

const handleAuth = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (!email || !password) {
        showError('authError', 'Please fill in all fields');
        return;
    }

    try {
        if (isSignUp) {
            if (!username) {
                showError('usernameError', 'Username is required');
                return;
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                username: username,
                email: email,
                lastSeen: serverTimestamp()
            });
            showSuccess('authSuccess', 'Account created successfully!');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showSuccess('authSuccess', 'Logged in successfully!');
        }
    } catch (error) {
        showError('authError', `Authentication error: ${error.message}`);
    }
};

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
        
        if (!userDoc.empty) {
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('chatContainer').style.display = 'grid';
            loadUsers();
        }
    } else {
        currentUser = null;
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('chatContainer').style.display = 'none';
    }
});

// Load users
async function loadUsers() {
    const usersRef = collection(db, 'users');
    onSnapshot(usersRef, (snapshot) => {
        const userList = document.getElementById('userList');
        userList.innerHTML = '';
        
        snapshot.forEach((doc) => {
            if (doc.id !== currentUser.uid) {
                const userData = doc.data();
                const li = document.createElement('li');
                li.textContent = userData.username || userData.email;
                li.className = 'user-item';
                li.onclick = () => selectUser(doc.id, userData.username || userData.email);
                userList.appendChild(li);
            }
        });
    });
}

// Select user to chat with
const selectUser = (userId, userName) => {
    selectedUser = userId;
    document.getElementById('currentChat').textContent = `Chat with ${userName}`;
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendButton').disabled = false;
    loadMessages();
};

// Send message
const sendMessage = async () => {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const message = messageInput.value.trim();
    if (!message || !selectedUser || !currentUser) return;

    try {
        await addDoc(collection(db, 'messages'), {
            sender: currentUser.uid,
            receiver: selectedUser,
            text: message,
            timestamp: serverTimestamp(),
            senderEmail: currentUser.email
        });
        messageInput.value = '';
        
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    } catch (error) {
        console.error("Error sending message:", error);
        showError('messageError', 'Failed to send message. Please try again.');
    }
};

// Load messages
function loadMessages() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';

    if (!currentUser || !selectedUser) {
        console.log("No users selected for chat");
        return;
    }

    // Create two separate queries for sent and received messages
    const sentQuery = query(
        collection(db, 'messages'),
        where('sender', '==', currentUser.uid),
        where('receiver', '==', selectedUser),
        orderBy('timestamp', 'asc')
    );

    const receivedQuery = query(
        collection(db, 'messages'),
        where('sender', '==', selectedUser),
        where('receiver', '==', currentUser.uid),
        orderBy('timestamp', 'asc')
    );

    // Create a message display function
    const displayMessage = (doc) => {
        const data = doc.data();
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.sender === currentUser.uid ? 'sent' : 'received'}`;
        messageDiv.setAttribute('data-id', doc.id);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = data.text;
        messageDiv.appendChild(messageContent);

        if (data.timestamp) {
            const messageTime = document.createElement('div');
            messageTime.className = 'message-time';
            const timestamp = data.timestamp.toDate();
            messageTime.textContent = formatTime(timestamp);
            messageDiv.appendChild(messageTime);
        }

        if (data.sender === currentUser.uid) {
            const actionDiv = document.createElement('div');
            actionDiv.className = 'message-actions';

            const editButton = document.createElement('button');
            editButton.className = 'message-button edit';
            editButton.textContent = 'Edit';
            editButton.onclick = () => editMessage(doc.id, data.text);
            actionDiv.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'message-button delete';
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = () => deleteMessage(doc.id);
            actionDiv.appendChild(deleteButton);

            messageDiv.appendChild(actionDiv);
        }

        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    // Set up listeners for both queries
    const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                displayMessage(change.doc);
            } else if (change.type === 'modified') {
                const messageDiv = messagesDiv.querySelector(`[data-id="${change.doc.id}"]`);
                if (messageDiv) {
                    messageDiv.querySelector('div').textContent = change.doc.data().text;
                }
            } else if (change.type === 'removed') {
                const messageDiv = messagesDiv.querySelector(`[data-id="${change.doc.id}"]`);
                if (messageDiv) {
                    messagesDiv.removeChild(messageDiv);
                }
            }
        });
    }, (error) => {
        console.error("Error in sent messages listener:", error);
        showError('messageError', 'Error loading sent messages');
    });

    const unsubscribeReceived = onSnapshot(receivedQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                displayMessage(change.doc);
            } else if (change.type === 'modified') {
                const messageDiv = messagesDiv.querySelector(`[data-id="${change.doc.id}"]`);
                if (messageDiv) {
                    messageDiv.querySelector('div').textContent = change.doc.data().text;
                }
            } else if (change.type === 'removed') {
                const messageDiv = messagesDiv.querySelector(`[data-id="${change.doc.id}"]`);
                if (messageDiv) {
                    messagesDiv.removeChild(messageDiv);
                }
            }
        });
    }, (error) => {
        console.error("Error in received messages listener:", error);
        showError('messageError', 'Error loading received messages');
    });

    // Store unsubscribe functions for cleanup
    return () => {
        unsubscribeSent();
        unsubscribeReceived();
    };
}

// Edit message
async function editMessage(messageId, oldText) {
    const newText = prompt("Edit your message:", oldText);
    if (newText !== null && newText !== oldText) {
        try {
            await updateDoc(doc(db, 'messages', messageId), {
                text: newText,
                editedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error editing message:", error);
            showError('messageError', 'Failed to edit message. Please try again.');
        }
    }
}

// Delete message
async function deleteMessage(messageId) {
    if (confirm("Are you sure you want to delete this message?")) {
        try {
            await deleteDoc(doc(db, 'messages', messageId));
        } catch (error) {
            console.error("Error deleting message:", error);
            showError('messageError', 'Failed to delete message. Please try again.');
        }
    }
}

// Clear chat
const clearChat = async () => {
    if (confirm("Are you sure you want to clear the chat?")) {
        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('sender', 'in', [currentUser.uid, selectedUser]),
            where('receiver', 'in', [currentUser.uid, selectedUser])
        );

        const snapshot = await getDocs(q);
        const batch = db.batch();
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        try {
            await batch.commit();
            document.getElementById('messages').innerHTML = '';
        } catch (error) {
            console.error("Error clearing chat:", error);
            showError('messageError', 'Failed to clear chat. Please try again.');
        }
    }
};

// Typing indicator
document.getElementById('messageInput').addEventListener('input', () => {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    setDoc(doc(db, 'typing', currentUser.uid), {
        typing: true,
        receiver: selectedUser
    });

    typingTimeout = setTimeout(() => {
        setDoc(doc(db, 'typing', currentUser.uid), {
            typing: false,
            receiver: selectedUser
        });
    }, 2000);
});

// Listen for typing indicator
onSnapshot(doc(db, 'typing', selectedUser), (doc) => {
    if (doc.exists() && doc.data().receiver === currentUser.uid) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (doc.data().typing) {
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }
});

// Logout function
const logout = async () => {
    try {
        await signOut(auth);
        selectedUser = null;
        showSuccess('authSuccess', 'Logged out successfully!');
    } catch (error) {
        showError('userError', 'Error logging out');
    }
};

// Utility functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.opacity = '1';
    setTimeout(() => {
        element.style.opacity = '0';
        setTimeout(() => element.textContent = '', 300);
    }, 5000);
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.opacity = '1';
    setTimeout(() => {
        element.style.opacity = '0';
        setTimeout(() => element.textContent = '', 300);
    }, 3000);
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    }).format(date);
}

// Theme toggle
const toggleTheme = () => {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
};

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
});

// Add functions to window object
window.toggleAuthMode = toggleAuthMode;
window.handleAuth = handleAuth;
window.selectUser = selectUser;
window.sendMessage = sendMessage;
window.clearChat = clearChat;
window.logout = logout;
window.toggleTheme = toggleTheme;

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuth();
            }
        });
    });
});
