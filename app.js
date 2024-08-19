const mainurl = "https://ollama.url/api/chat";
const modelname = "modelname:tag";

document.addEventListener('DOMContentLoaded', () => {
    const chatDisplay = document.getElementById('chat-display');
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');
    const chatBtn = document.getElementById('chat-btn');
    const chatBtnTxt = document.getElementById('chat-btn-text');
    const chatLoading = document.getElementById('chat-loading');
    const chatHistory = loadChatHistory();

    // Load chat history on page load
    renderChatHistory();

    // Event listener for clearing chat history
    document.getElementById('chat-clear').addEventListener('click', clearChatHistory);

    // Event listener for handling Enter key submission
    chatInput.addEventListener('keydown', handleKeyDown);

    // Event listener for submitting chat form
    chatForm.addEventListener('submit', handleFormSubmit);

    // Load chat history from localStorage
    function loadChatHistory() {
        return JSON.parse(localStorage.getItem('chatHistory')) || [];
    }

    // Save chat history to localStorage
    function saveChatHistory() {
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }

    // Render chat history
    function renderChatHistory() {
        chatDisplay.innerHTML = '';
        chatHistory.forEach(item => appendMessage(item.message, item.from));
        scrollToBottom();
    }

    // Append a new message to the chat display
    function appendMessage(message, from) {
        chatInput.value=""; // reset chat input
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('mb-2', from === 'user' ? 'text-right' : 'text-left');
        msgDiv.innerHTML = `<div class="inline-block ${from === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-300 dark:bg-gray-600 text-black dark:text-white rounded-bl-none'} p-2 rounded-lg whitespace-pre-wrap" style="max-width:80%">${message}</div>`;
        chatDisplay.appendChild(msgDiv);
        scrollToBottom();
    }

    // Scroll chat display to the bottom
    function scrollToBottom() {
        chatDisplay.scrollTo({ top: chatDisplay.scrollHeight, behavior: 'smooth' });
    }

    // Save a new message to history and localStorage
    function saveMessage(message, from) {
        chatHistory.push({ message, from });
        saveChatHistory();
        if(from!='assistant') appendMessage(message, from); //skip append message for assistant, message processed while streaming
    }

    // Clear chat history
    function clearChatHistory() {
        chatDisplay.innerHTML = '';
        chatHistory.length = 0;
        saveChatHistory();
    }

    // Handle Enter key press
    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (chatInput.value.trim() !== '') {
                chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    }

    // Handle chat form submission
    async function handleFormSubmit(event) {
        event.preventDefault();
        const input = chatInput.value.trim();

        if (input === '') return;

        saveMessage(input, 'user');
        toggleInputState(true);

        try {
            const prompt = buildChatPrompt(chatHistory);
            const response = await fetch(mainurl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelname, messages: prompt, keep_alive: -1 })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            await streamResponse(response.body.getReader());
        } catch (error) {
            console.error('Error:', error);
        } finally {
            toggleInputState(false);
        }
    }

    // Build chat prompt from chat history
    function buildChatPrompt(history) {
        const prompt = [{ role: 'system', content: 'You are a friendly AI assistant. You are talkative and provide lots of specific details from its context.' }];
        history.forEach(item => prompt.push({ role: item.from, content: item.message }));
        return prompt;
    }

    // Stream and display the bot's response
    async function streamResponse(reader) {
        const decoder = new TextDecoder();
        let content = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            text.split('\n').forEach(line => {
                if (line.trim() === '') return;

                try {
                    const chunk = JSON.parse(line);
                    if (!chunk.done) {
                        content += chunk.message.content;
                        appendStreamingMessage(content);
                    } else {
                        finalizeMessage(content);
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                }
            });
        }
    }

    // Append a streaming message
    function appendStreamingMessage(content) {
        let botMessage = chatDisplay.querySelector('.streaming');
        if (!botMessage) {
            botMessage = document.createElement('div');
            botMessage.classList.add('mb-2', 'text-left', 'streaming');
            chatDisplay.appendChild(botMessage);
        }
        botMessage.innerHTML = `<div class="inline-block bg-gray-300 dark:bg-gray-600 text-black dark:text-white p-2 rounded-lg rounded-bl-none whitespace-pre-wrap" style="max-width:80%">${content}</div>`;
        scrollToBottom();
    }

    // Finalize and save the bot's message
    function finalizeMessage(content) {
        const botMessage = chatDisplay.querySelector('.streaming');
        if (botMessage) {
            botMessage.classList.remove('streaming');
        }
        saveMessage(content, 'assistant');
    }

    // Toggle input and button state
    function toggleInputState(isDisabled) {
        chatInput.disabled = isDisabled;
        chatBtn.disabled = isDisabled;
        chatInput.placeholder = isDisabled ? 'Processing...' : 'Ask anything...';
        chatBtnTxt.classList.toggle('hidden', isDisabled);
        chatLoading.classList.toggle('hidden', !isDisabled);
        if (!isDisabled) chatInput.focus();
    }
});
