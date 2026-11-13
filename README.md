# 📞 Ligação IA

**Sistema de bate-papo por ligação telefônica com Inteligência Artificial em tempo real.**

Um projeto 100% front-end que simula uma chamada telefônica com o Gemini (Google AI). A interface imita a experiência de um smartphone, com reconhecimento de voz contínuo, respostas faladas e visualizador de ondas sonoras.

Ideal para portfólio: demonstra domínio de Web Speech API, Web Audio API, integração com LLM via REST e UI/UX mobile-first com glassmorphism.

---

## ✨ Funcionalidades

- **Tela de discador** com entrada de chave API (salva apenas em `sessionStorage`)
- **Chamada ativa** com:
  - Avatar e nome do contato de IA
  - Status dinâmico (Chamando…, Ouvindo…, Pensando…, Falando…)
  - Cronômetro em tempo real
  - Visualizador de ondas sonoras animado
  - Controles clássicos de telefone:
    - Mudo
    - Teclado DTMF com sons de bipe reais (Web Audio API)
    - Pausar / Retomar
    - Encerrar chamada
- **Motor de conversação 100% client-side**:
  - `SpeechRecognition` (pt-BR) contínuo
  - Envio da transcrição para Gemini
  - `speechSynthesis` (pt-BR) para a resposta
  - Retoma automática da escuta após a fala da IA
- Tratamento amigável de erros (navegador sem suporte, permissão de microfone, chave inválida)
- Tema escuro moderno com glassmorphism
- Mobile-first e responsivo

---

## 🚀 Como usar

1. Obtenha uma chave API gratuita do Gemini em [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Abra o `index.html` no navegador (ou hospede no GitHub Pages).
3. Cole a chave API e clique em **Iniciar Ligação**.
4. Autorize o microfone e converse naturalmente.

> **Nota sobre o modelo**: O projeto usa `gemini-2.5-flash`. Em novembro de 2026 esse modelo está em processo de depreciação. Se receber erro 404, altere a variável `this.model` em `js/app.js` para `gemini-2.5-flash-lite` ou o modelo mais recente disponível no AI Studio.

---

## 📁 Estrutura do projeto

```
.
├── index.html          # Estrutura principal
├── css/
│   └── style.css       # Estilos (dark + glassmorphism)
├── js/
│   └── app.js          # Lógica completa (Speech + Gemini + Audio)
└── README.md
```

---

## 🛠️ Tecnologias

- HTML5 / CSS3 (Glassmorphism, CSS Animations)
- JavaScript Vanilla (ES6+)
- Web Speech API (`SpeechRecognition` + `speechSynthesis`)
- Web Audio API (tons DTMF)
- Gemini API (`generateContent`)

---

## 🔒 Privacidade

A chave API **nunca** sai do navegador do usuário. Ela é armazenada apenas em `sessionStorage` e enviada diretamente para a API do Google. Não há backend, banco de dados ou coleta de dados.

---

## 📱 Hospedagem

Pronto para **GitHub Pages**:

1. Crie um repositório público
2. Faça upload dos arquivos
3. Ative GitHub Pages na branch `main` (pasta raiz)

---

## 👨‍💻 Autor

Desenvolvido como projeto de portfólio por [farrei](https://github.com/farrei).

---

## 📄 Licença

MIT – use, modifique e distribua livremente.
