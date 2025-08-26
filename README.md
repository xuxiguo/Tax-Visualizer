# Progressive Tax Bracket Visualizer

An interactive React application that visualizes how progressive tax brackets work, showing animated income flow through different tax brackets.

**Live Demo:** https://xuxiguo.github.io/Tax-Visualizer/

## Features

- Interactive tax bracket visualization with animated flow
- Customizable income, deductions, and tax brackets
- Real-time calculations of marginal and average tax rates
- Responsive design with Tailwind CSS
- Smooth animations with Framer Motion

## Setup Instructions

### Option 1: Local Development

1. **Navigate to the project directory:**
   ```bash
   cd tax-visualizer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser to:** `http://localhost:5173`

### Option 2: Deploy to GitHub Pages

1. **Create a new GitHub repository** (e.g., `progressive-tax-visualizer`)

2. **Update the base path in `vite.config.ts`:**
   ```typescript
   base: '/your-repo-name/', // Replace with your actual repo name
   ```

3. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/your-repo-name.git
   git push -u origin main
   ```

4. **Deploy to GitHub Pages:**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages:**
   - Go to your repo settings
   - Scroll to "Pages" section
   - Set source to "Deploy from a branch"
   - Select "gh-pages" branch
   - Your app will be available at: `https://YOUR_USERNAME.github.io/your-repo-name/`

## Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons

## Usage

1. Adjust the gross income and deductions using sliders or input fields
2. Modify tax brackets by changing rates or adding/removing brackets
3. Click "Play" to watch the animated visualization of income flowing through brackets
4. View detailed breakdown in the table at the bottom

## Educational Value

Perfect for teaching:
- How progressive taxation works
- Difference between marginal and average tax rates
- Impact of deductions on taxable income
- Visual understanding of tax bracket mechanics

## Browser Compatibility

Works in all modern browsers that support:
- ES2020 features
- CSS Grid and Flexbox
- requestAnimationFrame API
