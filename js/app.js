/**
 * Ligação IA - Sistema de chamada telefônica com Gemini (100% Front-End)
 * Usa Web Speech API + Gemini generateContent + speechSynthesis
 * Privacidade: chave API apenas em sessionStorage
 */

class PhoneCallAI {
  constructor() {
    // Elementos DOM
    this.dialerScreen = document.getElementById('dialer-screen');
    this.callScreen = document.getElementById('call-screen');
    this.apiKeyInput = document.getElementById('api-key');
    this.startCallBtn = document.getElementById('start-call');
    this.errorMessage = document.getElementById('error-message');
    this.statusEl = document.getElementById('status');
    this.timerEl = document.getElementById('timer');
    this.waveformEl = document.getElementById('waveform');
    this.muteBtn = document.getElementById('mute-btn');
    this.keypadBtn = document.getElementById('keypad-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.endBtn = document.getElementById('end-btn');
    this.keypad = document.getElementById('keypad');
    this.closeKeypadBtn = document.getElementById('close-keypad');
    this.voiceSelect = document.getElementById('voice-select');

    // Estado
    this.apiKey = '';
    this.recognition = null;
    this.isListening = false;
    this.isMuted = false;
    this.isPaused = false;
    this.isSpeaking = false;
    this.callStartTime = null;
    this.timerInterval = null;
    this.conversationHistory = [];
    this.audioContext = null;
    this.waveformInterval = null;
    this.selectedVoice = null;

    // Modelo recomendado para novos usuários (novembro 2026)
    this.model = 'gemini-3.5-flash-lite';

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadApiKey();
    this.createWaveformBars();
    this.checkSpeechSupport();
    this.loadVoices();
  }

  checkSpeechSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showError('Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari recente.');
      this.startCallBtn.disabled = true;
    }
    if (!window.speechSynthesis) {
      this.showError('Seu navegador não suporta síntese de voz.');
    }
  }

  setupEventListeners() {
    this.apiKeyInput.addEventListener('input', () => {
      this.startCallBtn.disabled = !this.apiKeyInput.value.trim();
      this.clearError();
    });

    this.startCallBtn.addEventListener('click', () => this.startCall());
    this.muteBtn.addEventListener('click', () => this.toggleMute());
    this.keypadBtn.addEventListener('click', () => this.toggleKeypad());
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.endBtn.addEventListener('click', () => this.endCall());
    this.closeKeypadBtn.addEventListener('click', () => this.toggleKeypad(false));

    if (this.voiceSelect) {
      this.voiceSelect.addEventListener('change', () => {
        const name = this.voiceSelect.value;
        const voices = speechSynthesis.getVoices();
        this.selectedVoice = voices.find(v => v.name === name) || null;
      });
    }

    // Teclas do DTMF
    document.querySelectorAll('.key').forEach(btn => {
      btn.addEventListener('click', () => {
        const tone = btn.dataset.tone;
        this.playDTMF(tone);
      });
    });
  }

  loadVoices() {
    const populate = () => {
      if (!this.voiceSelect) return;
      const voices = speechSynthesis.getVoices();
      const ptVoices = voices.filter(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt'));
      
      // Limpa opções antigas (mantém a primeira)
      while (this.voiceSelect.options.length > 1) {
        this.voiceSelect.remove(1);
      }

      ptVoices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        this.voiceSelect.appendChild(opt);
      });

      // Tenta pré-selecionar uma voz mais robusta/humana se existir
      const preferred = ptVoices.find(v => 
        /google|natural|premium|enhanced|neural|female|feminino|masculino|male/i.test(v.name)
      ) || ptVoices[0];
      if (preferred) {
        this.selectedVoice = preferred;
        this.voiceSelect.value = preferred.name;
      }
    };

    populate();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populate;
    }
  }

  loadApiKey() {
    const saved = sessionStorage.getItem('gemini_api_key');
    if (saved) {
      this.apiKeyInput.value = saved;
      this.startCallBtn.disabled = false;
    }
  }

  saveApiKey() {
    this.apiKey = this.apiKeyInput.value.trim();
    sessionStorage.setItem('gemini_api_key', this.apiKey);
  }

  createWaveformBars() {
    this.waveformEl.innerHTML = '';
    for (let i = 0; i < 20; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.animationDelay = `${i * 0.05}s`;
      this.waveformEl.appendChild(bar);
    }
  }

  showError(msg) {
    this.errorMessage.textContent = msg;
  }

  clearError() {
    this.errorMessage.textContent = '';
  }

  async startCall() {
    this.clearError();
    this.saveApiKey();

    if (!this.apiKey) {
      this.showError('Por favor, insira uma chave de API válida.');
      return;
    }

    // Teste rápido da chave
    try {
      await this.testApiKey();
    } catch (err) {
      this.showError(err.message || 'Chave de API inválida ou sem permissão. Verifique em Google AI Studio.');
      return;
    }

    this.switchToCallScreen();
    this.setStatus('Chamando...');
    this.startTimer();

    // Pequeno delay para simular "discando"
    setTimeout(() => {
      this.initSpeechRecognition();
      this.startListening();
      this.setStatus('Ouvindo...');
      this.waveformEl.classList.add('active');
    }, 1200);
  }

  async testApiKey() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'oi' }] }]
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || `Erro ${res.status}: modelo ou chave inválida`;
      throw new Error(msg);
    }
  }

  switchToCallScreen() {
    this.dialerScreen.classList.remove('active');
    this.callScreen.classList.add('active');
  }

  switchToDialerScreen() {
    this.callScreen.classList.remove('active');
    this.dialerScreen.classList.add('active');
  }

  setStatus(text) {
    this.statusEl.textContent = text;
    this.statusEl.className = 'status';
    if (text.includes('Ouvindo')) this.statusEl.classList.add('listening');
    else if (text.includes('Pensando')) this.statusEl.classList.add('thinking');
    else if (text.includes('Falando')) this.statusEl.classList.add('speaking');
  }

  startTimer() {
    this.callStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      this.timerEl.textContent = `${min}:${sec}`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerEl.textContent = '00:00';
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-BR';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      if (this.isMuted || this.isPaused || this.isSpeaking) return;

      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const transcript = last[0].transcript.trim();
        if (transcript.length > 1) {
          this.handleUserSpeech(transcript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.showError('Permissão de microfone negada. Ative nas configurações do navegador.');
        this.endCall();
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // Reinicia em caso de erro recuperável
        if (!this.isPaused && !this.isMuted) {
          setTimeout(() => this.startListening(), 500);
        }
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // Reinicia automaticamente se a chamada estiver ativa e não estiver falando
      if (this.callScreen.classList.contains('active') && !this.isPaused && !this.isMuted && !this.isSpeaking) {
        setTimeout(() => this.startListening(), 200);
      }
    };
  }

  startListening() {
    if (this.isMuted || this.isPaused || this.isSpeaking || !this.recognition) return;
    try {
      this.recognition.start();
      this.isListening = true;
      this.setStatus('Ouvindo...');
    } catch (e) {
      // Já está ouvindo
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  async handleUserSpeech(transcript) {
    this.stopListening();
    this.setStatus('Pensando...');
    this.waveformEl.classList.remove('active');

    // Adiciona ao histórico
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: transcript }]
    });

    try {
      const responseText = await this.askGemini();
      if (responseText) {
        this.conversationHistory.push({
          role: 'model',
          parts: [{ text: responseText }]
        });
        await this.speak(responseText);
      }
    } catch (err) {
      console.error(err);
      this.setStatus('Erro ao processar');
      await this.speak('Desculpe, tive um problema. Pode repetir?');
    } finally {
      if (!this.isPaused && !this.isMuted) {
        this.waveformEl.classList.add('active');
        this.startListening();
      }
    }
  }

  async askGemini() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      contents: this.conversationHistory,
      systemInstruction: {
        parts: [{
          text: `Você é um assistente amigável falando ao telefone em português brasileiro. 
Responda de forma curta, natural, coloquial e conversacional, como uma pessoa real ao telefone. 
Não use Markdown, listas, asteriscos, emojis ou formatação. 
Mantenha as respostas objetivas e com no máximo 2-3 frases. 
Seja empático e natural.`
        }]
      },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 120,
        topP: 0.9
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Erro na API Gemini');
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  }

  async speak(text) {
    return new Promise((resolve) => {
      if (!text) {
        resolve();
        return;
      }

      this.isSpeaking = true;
      this.setStatus('Falando...');
      this.waveformEl.classList.add('active');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      // Ajustes para soar mais natural e robusta
      utterance.rate = 0.95;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;

      // Usa a voz selecionada ou a melhor disponível
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      } else {
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find(v => 
          (v.lang.startsWith('pt-BR') || v.lang.startsWith('pt')) &&
          /google|natural|premium|enhanced|neural/i.test(v.name)
        ) || voices.find(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt'));
        if (preferred) utterance.voice = preferred;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        this.waveformEl.classList.remove('active');
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      // Cancela qualquer fala anterior
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.muteBtn.classList.toggle('active', this.isMuted);
    this.muteBtn.querySelector('.icon').textContent = this.isMuted ? '🔇' : '🎤';
    this.muteBtn.querySelector('.label').textContent = this.isMuted ? 'Ativar' : 'Mudo';

    if (this.isMuted) {
      this.stopListening();
      this.setStatus('Mudo');
      this.waveformEl.classList.remove('active');
    } else if (!this.isPaused && !this.isSpeaking) {
      this.startListening();
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.pauseBtn.classList.toggle('active', this.isPaused);
    this.pauseBtn.querySelector('.icon').textContent = this.isPaused ? '▶️' : '⏸️';
    this.pauseBtn.querySelector('.label').textContent = this.isPaused ? 'Retomar' : 'Pausar';

    if (this.isPaused) {
      this.stopListening();
      speechSynthesis.cancel();
      this.isSpeaking = false;
      this.setStatus('Pausado');
      this.waveformEl.classList.remove('active');
    } else if (!this.isMuted) {
      this.startListening();
    }
  }

  toggleKeypad(force) {
    const show = force !== undefined ? force : this.keypad.classList.contains('hidden');
    this.keypad.classList.toggle('hidden', !show);
  }

  // DTMF com Web Audio API (tons padrão de telefone)
  playDTMF(digit) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const frequencies = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };

    const freqs = frequencies[digit];
    if (!freqs) return;

    const duration = 0.15;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    gainNode.connect(this.audioContext.destination);

    freqs.forEach(freq => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    });
  }

  endCall() {
    this.stopListening();
    speechSynthesis.cancel();
    this.stopTimer();
    this.waveformEl.classList.remove('active');
    this.isSpeaking = false;
    this.isPaused = false;
    this.isMuted = false;

    // Reset UI
    this.muteBtn.classList.remove('active');
    this.muteBtn.querySelector('.icon').textContent = '🎤';
    this.muteBtn.querySelector('.label').textContent = 'Mudo';
    this.pauseBtn.classList.remove('active');
    this.pauseBtn.querySelector('.icon').textContent = '⏸️';
    this.pauseBtn.querySelector('.label').textContent = 'Pausar';
    this.keypad.classList.add('hidden');

    this.conversationHistory = [];
    this.switchToDialerScreen();
    this.setStatus('Chamando...');
  }
}

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', () => {
  // Garante que as vozes estejam carregadas
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {};
  }
  new PhoneCallAI();
});
