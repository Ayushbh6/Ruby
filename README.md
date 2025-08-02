# 🤖 Ruby - CodeAct Learning Agent for Kids

**"Every child deserves a patient, encouraging coding teacher who makes programming feel like play."**

Ruby is an AI-powered coding teacher designed to introduce children (ages 6-12) to programming through interactive, project-based learning. Built on the proven CodeAct framework, Ruby generates live code demonstrations, creates engaging educational games, and provides personalized learning experiences that make coding accessible and fun for young learners.

## 🎯 What Makes Ruby Special

- **🎪 AI Teacher with Personality**: Ruby is a patient, encouraging AI teacher who adapts to each child's learning style
- **⚡ Live Code Execution**: All code runs instantly in the browser - JavaScript/React and Python support
- **🎮 Project-Based Learning**: Kids build real games and apps, not just follow tutorials
- **📚 Structured Learning**: 4-week projects broken into weekly goals with unlimited exploration
- **🧠 Learning Memory**: Ruby remembers what worked, what confused, and what excited each child
- **🎯 Smart Goal Setting**: Ruby enforces specific, achievable projects and tracks progress internally

## 🚀 Key Features

### MVP Core Features
- **Project Scoping System**: Ruby refuses vague goals and demands specific, buildable projects
- **Live Code Execution**: Zero-latency JavaScript/React and Python execution in browser
- **Adaptive Teaching**: 2-strike failure system that adjusts difficulty when children struggle
- **Conversation Memory**: Complete learning history and personalized teaching approaches
- **Structured Projects**: Weekly folders with unlimited chats for flexible exploration

### Target Projects (Examples)
- **Week 1-4**: Build a Python Calculator
- **Week 1-3**: Create Snake Game in JavaScript
- **Week 1-2**: Interactive Tic-Tac-Toe
- **Week 1-4**: Personal Portfolio Website

## 👥 Who Is Ruby For?

### Primary Users: Children (6-12 years)
- **Ages 6-8**: Visual learners who enjoy colors, animations, and immediate feedback
- **Ages 9-12**: Students ready for logical thinking and basic programming concepts
- **Learning Style**: Curious, impatient for results, learn through play and exploration

### Secondary Users: Parents & Educators
- **Parents**: Want quality STEM education with progress tracking and safe online learning
- **Teachers**: Need curriculum-aligned tools for computer science education
- **Homeschool Educators**: Seeking structured yet flexible programming curricula

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend**: Next.js 14+ with TypeScript and Tailwind CSS
- **Hosting**: Railway for seamless deployment and scaling
- **Database**: Supabase (PostgreSQL) with real-time features
- **AI**: Gemini API for Ruby's teaching intelligence
- **Code Execution**: 
  - JavaScript: CodeMirror + Babel transpilation
  - Python: Pyodide for full Python runtime in browser

### Core Components
- **Live Code Editor**: CodeMirror with kid-friendly themes
- **Instant Preview**: Real-time code execution and visual feedback
- **Project Management**: Structured weekly folders and unlimited chats
- **AI Teacher**: Pattern recognition and adaptive teaching strategies

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ayushbh6/Ruby.git
   cd Ruby
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Add your API keys for Gemini and Supabase
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📊 Project Structure

```
ruby/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript types
├── public/                # Static assets
├── docs/                  # Documentation
└── README.md             # This file
```

## 🎯 Development Roadmap

### MVP Timeline (8 Weeks)

#### Weeks 1-2: Foundation
- [x] Supabase auth + enhanced database schema
- [x] Basic Ruby personality with Gemini
- [x] Client-side code editor (CodeMirror)
- [ ] Simple project creation flow

#### Weeks 3-4: Core Experience
- [ ] Live preview with Babel transpilation
- [ ] First game: Tic-Tac-Toe template
- [ ] Basic memory system (what worked/didn't)
- [ ] Timeline tracking (days since start)

#### Weeks 5-6: Teaching Intelligence
- [ ] Intervention triggers (3 key ones)
- [ ] Second game: Bouncing Ball
- [ ] Progress tracking and patterns
- [ ] Ruby learns child's pace

#### Weeks 7-8: Polish & Launch
- [ ] Third game: Simple Snake
- [ ] Parent visibility (basic)
- [ ] Beta with 10 families
- [ ] Iterate based on feedback

## 🛡️ Privacy & Safety

### Child Safety (COPPA Compliance)
- **Parental Consent**: Required for account creation
- **Data Minimization**: Collect only necessary learning data
- **Content Moderation**: AI safety filters for all interactions
- **Secure Communication**: No direct child-to-child messaging

### Educational Privacy
- **Learning Data**: Used only for educational improvement
- **Progress Reports**: Transparent sharing with parents
- **Data Retention**: Clear policies on data storage and deletion

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

- **Project Lead**: [Ayushbh6](https://github.com/Ayushbh6)
- **Project Repository**: [Ruby](https://github.com/Ayushbh6/Ruby)
- **Documentation**: [Product Requirements Document](docs/PRD.md)

---

*Building the future of coding education, one child at a time.* 🚀
