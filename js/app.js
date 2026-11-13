/**
 * Ligação IA - Sistema de chamada telefônica com Gemini (100% Front-End)
 * Modo Demonstração funciona sem chave API
 */

class PhoneCallAI {
  constructor() {
    this.dialerScreen = document.getElementById('dialer-screen');
    this.callScreen = document.getElementById('call-screen');
    this.apiKeyInput = document.getElementById('api-key');
    this.startCallBtn = document.getElementById('start-call');
    this.startDemoBtn = document.getElementById('start-demo');
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
    this.contactNameEl = document.getElementById('contact-name');

    this.apiKey = '';
    this.isDemoMode = false;
    this.recognition = null;
    this.isListening = false;
    this.isMuted = false;
    this.isPaused = false;
    this.isSpeaking = false;
    this.callStartTime = null;
    this.timerInterval = null;
    this.conversationHistory = [];
    this.audioContext = null;
    this.selectedVoice = null;
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
      this.showError('Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari.');
      if (this.startCallBtn) this.startCallBtn.disabled = true;
      if (this.startDemoBtn) this.startDemoBtn.disabled = true;
    }
  }

  setupEventListeners() {
    if (this.apiKeyInput) {
      this.apiKeyInput.addEventListener('input', () => {
        if (this.startCallBtn) this.startCallBtn.disabled = !this.apiKeyInput.value.trim();
        this.clearError();
      });
    }

    if (this.startCallBtn) this.startCallBtn.addEventListener('click', () => this.startCall(false));
    if (this.startDemoBtn) this.startDemoBtn.addEventListener('click', () => this.startCall(true));
    if (this.muteBtn) this.muteBtn.addEventListener('click', () => this.toggleMute());
    if (this.keypadBtn) this.keypadBtn.addEventListener('click', () => this.toggleKeypad());
    if (this.pauseBtn) this.pauseBtn.addEventListener('click', () => this.togglePause());
    if (this.endBtn) this.endBtn.addEventListener('click', () => this.endCall());
    if (this.closeKeypadBtn) this.closeKeypadBtn.addEventListener('click', () => this.toggleKeypad(false));

    if (this.voiceSelect) {
      this.voiceSelect.addEventListener('change', () => {
        const name = this.voiceSelect.value;
        const voices = speechSynthesis.getVoices();
        this.selectedVoice = voices.find(v => v.name === name) || null;
      });
    }

    document.querySelectorAll('.key').forEach(btn => {
      btn.addEventListener('click', () => this.playDTMF(btn.dataset.tone));
    });
  }

  loadVoices() {
    const populate = () => {
      if (!this.voiceSelect) return;
      const voices = speechSynthesis.getVoices();
      const ptVoices = voices.filter(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt'));
      while (this.voiceSelect.options.length > 1) this.voiceSelect.remove(1);
      ptVoices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        this.voiceSelect.appendChild(opt);
      });
      const preferred = ptVoices.find(v => /google|natural|premium|enhanced|neural/i.test(v.name)) || ptVoices[0];
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
    if (saved && this.apiKeyInput) {
      this.apiKeyInput.value = saved;
      if (this.startCallBtn) this.startCallBtn.disabled = false;
    }
  }

  saveApiKey() {
    this.apiKey = this.apiKeyInput ? this.apiKeyInput.value.trim() : '';
    if (this.apiKey) sessionStorage.setItem('gemini_api_key', this.apiKey);
  }

  createWaveformBars() {
    if (!this.waveformEl) return;
    this.waveformEl.innerHTML = '';
    for (let i = 0; i < 20; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.animationDelay = `${i * 0.05}s`;
      this.waveformEl.appendChild(bar);
    }
  }

  showError(msg) {
    if (this.errorMessage) this.errorMessage.textContent = msg;
  }

  clearError() {
    if (this.errorMessage) this.errorMessage.textContent = '';
  }

  async startCall(isDemo = false) {
    this.clearError();
    this.isDemoMode = isDemo;

    if (!isDemo) {
      this.saveApiKey();
      if (!this.apiKey) {
        this.showError('Insira uma chave de API ou use o modo demonstração.');
        return;
      }
      try {
        await this.testApiKey();
      } catch (err) {
        this.showError(err.message || 'Chave de API inválida.');
        return;
      }
    }

    if (this.contactNameEl) {
      this.contactNameEl.textContent = isDemo ? 'Assistente (Demo)' : 'Assistente IA';
    }

    this.switchToCallScreen();
    this.setStatus('Chamando...');
    this.startTimer();

    setTimeout(async () => {
      this.initSpeechRecognition();
      this.setStatus('Ouvindo...');
      if (this.waveformEl) this.waveformEl.classList.add('active');

      if (isDemo) {
        await this.speak('Olá! Modo demonstração ativado. Pode falar comigo.');
      }
      this.startListening();
    }, 1000);
  }

  async testApiKey() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'oi' }] }] })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Erro ${res.status}`);
    }
  }

  switchToCallScreen() {
    if (this.dialerScreen) this.dialerScreen.classList.remove('active');
    if (this.callScreen) this.callScreen.classList.add('active');
  }

  switchToDialerScreen() {
    if (this.callScreen) this.callScreen.classList.remove('active');
    if (this.dialerScreen) this.dialerScreen.classList.add('active');
  }

  setStatus(text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = 'status';
    if (text.includes('Ouvindo')) this.statusEl.classList.add('listening');
    else if (text.includes('Pensando')) this.statusEl.classList.add('thinking');
    else if (text.includes('Falando')) this.statusEl.classList.add('speaking');
  }

  startTimer() {
    this.callStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (!this.timerEl) return;
      const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      this.timerEl.textContent = `${min}:${sec}`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    if (this.timerEl) this.timerEl.textContent = '00:00';
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
        if (transcript.length > 1) this.handleUserSpeech(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.showError('Permissão de microfone negada.');
        this.endCall();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.callScreen && this.callScreen.classList.contains('active') && !this.isPaused && !this.isMuted && !this.isSpeaking) {
        setTimeout(() => this.startListening(), 300);
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
      console.warn('startListening failed', e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch (e) {}
      this.isListening = false;
    }
  }

  async handleUserSpeech(transcript) {
    this.stopListening();
    this.setStatus('Pensando...');
    if (this.waveformEl) this.waveformEl.classList.remove('active');

    this.conversationHistory.push({ role: 'user', parts: [{ text: transcript }] });

    try {
      const responseText = this.isDemoMode
        ? this.getDemoResponse(transcript)
        : await this.askGemini();

      if (responseText) {
        this.conversationHistory.push({ role: 'model', parts: [{ text: responseText }] });
        await this.speak(responseText);
      }
    } catch (err) {
      console.error(err);
      await this.speak('Desculpe, tive um problema. Pode repetir?');
    } finally {
      if (!this.isPaused && !this.isMuted && this.waveformEl) {
        this.waveformEl.classList.add('active');
        this.startListening();
      }
    }
  }

  getDemoResponse(text) {
    const t = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (/oi|ola|e ai|tudo bem|bom dia|boa tarde|boa noite/.test(t)) {
      return 'Olá! Tudo bem? Estou no modo demonstração. Como posso ajudar?';
    }
    if (/seu nome|quem e voce|quem e voc/.test(t)) {
      return 'Sou um assistente de demonstração. Para conversas mais inteligentes use uma chave do Gemini.';
    }
    if (/hora|que horas/.test(t)) {
      const now = new Date();
      return `Agora são ${now.getHours()} horas e ${now.getMinutes()} minutos.`;
    }
    if (/obrigad|valeu|vlw|thanks/.test(t)) {
      return 'De nada! Fico feliz em ajudar.';
    }
    if (/tchau|adeus|ate|encerrar|desligar/.test(t)) {
      return 'Tudo bem, até mais!';
    }
    if (/piada|engracado/.test(t)) {
      return 'Por que o computador foi ao médico? Porque estava com vírus!';
    }

    const generics = [
      'Entendi. Pode me contar mais?',
      'Interessante. E o que você acha?',
      'Certo. Quer que eu explique alguma coisa?',
      'Ok, anotei. Tem mais alguma coisa?',
      'Beleza. Estou aqui pra conversar.'
    ];
    return generics[Math.floor(Math.random() * generics.length)];
  }

  async askGemini() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      contents: this.conversationHistory,
      systemInstruction: {
        parts: [{ text: 'Você é um assistente amigável falando ao telefone em português brasileiro. Responda de forma curta, natural e coloquial. Sem Markdown. Máximo 2-3 frases.' }]
      },
      generationConfig: { temperature: 0.8, maxOutputTokens: 120 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Erro na API');
    }

    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  }

  async speak(text) {
    return new Promise((resolve) => {
      if (!text || !window.speechSynthesis) {
        resolve();
        return;
      }

      this.isSpeaking = true;
      this.setStatus('Falando...');
      if (this.waveformEl) this.waveformEl.classList.add('active');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95;
      utterance.pitch = 0.95;

      if (this.selectedVoice) utterance.voice = this.selectedVoice;

      utterance.onend = () => {
        this.isSpeaking = false;
        if (this.waveformEl) this.waveformEl.classList.remove('active');
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.muteBtn) {
      this.muteBtn.classList.toggle('active', this.isMuted);
      this.muteBtn.querySelector('.icon').textContent = this.isMuted ? '🔇' : '🎤';
      this.muteBtn.querySelector('.label').textContent = this.isMuted ? 'Ativar' : 'Mudo';
    }
    if (this.isMuted) {
      this.stopListening();
      this.setStatus('Mudo');
    } else if (!this.isPaused && !this.isSpeaking) {
      this.startListening();
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.pauseBtn) {
      this.pauseBtn.classList.toggle('active', this.isPaused);
      this.pauseBtn.querySelector('.icon').textContent = this.isPaused ? '▶️' : '⏸️';
      this.pauseBtn.querySelector('.label').textContent = this.isPaused ? 'Retomar' : 'Pausar';
    }
    if (this.isPaused) {
      this.stopListening();
      speechSynthesis.cancel();
      this.isSpeaking = false;
      this.setStatus('Pausado');
    } else if (!this.isMuted) {
      this.startListening();
    }
  }

  toggleKeypad(force) {
    if (!this.keypad) return;
    const show = force !== undefined ? force : this.keypad.classList.contains('hidden');
    this.keypad.classList.toggle('hidden', !show);
  }

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
    if (window.speechSynthesis) speechSynthesis.cancel();
    this.stopTimer();
    if (this.waveformEl) this.waveformEl.classList.remove('active');
    this.isSpeaking = false;
    this.isPaused = false;
    this.isMuted = false;
    this.isDemoMode = false;

    if (this.muteBtn) {
      this.muteBtn.classList.remove('active');
      this.muteBtn.querySelector('.icon').textContent = '🎤';
      this.muteBtn.querySelector('.label').textContent = 'Mudo';
    }
    if (this.pauseBtn) {
      this.pauseBtn.classList.remove('active');
      this.pauseBtn.querySelector('.icon').textContent = '⏸️';
      this.pauseBtn.querySelector('.label').textContent = 'Pausar';
    }
    if (this.keypad) this.keypad.classList.add('hidden');

    this.conversationHistory = [];
    this.switchToDialerScreen();
    this.setStatus('Chamando...');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {};
  }
  new PhoneCallAI();
});
