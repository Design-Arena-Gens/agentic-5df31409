'use client';

import { useEffect, useRef, useState } from 'react';

interface Vector2 {
  x: number;
  y: number;
}

interface Entity {
  pos: Vector2;
  vel: Vector2;
  radius: number;
}

interface Player extends Entity {
  health: number;
  maxHealth: number;
  fireRate: number;
  damage: number;
  speed: number;
  lastFired: number;
  invulnerable: number;
}

interface Enemy extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
  type: 'basic' | 'fast' | 'tank' | 'shooter';
  lastFired?: number;
  color: string;
}

interface Bullet extends Entity {
  damage: number;
  isPlayerBullet: boolean;
}

interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
}

interface PowerUp extends Entity {
  type: 'health' | 'damage' | 'firerate' | 'speed';
  color: string;
}

interface GameState {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  wave: number;
  waveProgress: number;
  enemiesThisWave: number;
  enemiesKilled: number;
  gameOver: boolean;
  paused: boolean;
  keys: Set<string>;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [showUI, setShowUI] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize game state
    const initGame = (): GameState => ({
      player: {
        pos: { x: canvas.width / 2, y: canvas.height - 100 },
        vel: { x: 0, y: 0 },
        radius: 15,
        health: 100,
        maxHealth: 100,
        fireRate: 150,
        damage: 10,
        speed: 5,
        lastFired: 0,
        invulnerable: 0,
      },
      enemies: [],
      bullets: [],
      particles: [],
      powerUps: [],
      score: 0,
      wave: 1,
      waveProgress: 0,
      enemiesThisWave: 5,
      enemiesKilled: 0,
      gameOver: false,
      paused: false,
      keys: new Set(),
    });

    gameStateRef.current = initGame();

    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStateRef.current) return;

      if (e.code === 'Space' && gameStateRef.current.gameOver) {
        gameStateRef.current = initGame();
        return;
      }

      if (e.code === 'KeyP') {
        gameStateRef.current.paused = !gameStateRef.current.paused;
        return;
      }

      gameStateRef.current.keys.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameStateRef.current) return;
      gameStateRef.current.keys.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Spawn enemy
    const spawnEnemy = (type: Enemy['type'], wave: number) => {
      const state = gameStateRef.current!;
      const configs = {
        basic: { health: 20 + wave * 5, speed: 2 + wave * 0.1, radius: 15, color: '#ff4444' },
        fast: { health: 10 + wave * 3, speed: 4 + wave * 0.2, radius: 10, color: '#ff8844' },
        tank: { health: 50 + wave * 15, speed: 1 + wave * 0.05, radius: 25, color: '#ff2222' },
        shooter: { health: 15 + wave * 4, speed: 1.5 + wave * 0.1, radius: 12, color: '#ff44ff' },
      };

      const config = configs[type];
      const enemy: Enemy = {
        pos: { x: Math.random() * canvas.width, y: -30 },
        vel: { x: 0, y: config.speed },
        radius: config.radius,
        health: config.health,
        maxHealth: config.health,
        speed: config.speed,
        type,
        color: config.color,
        lastFired: 0,
      };

      state.enemies.push(enemy);
    };

    // Spawn wave
    const spawnWave = (wave: number) => {
      const state = gameStateRef.current!;
      const count = 5 + wave * 2;
      state.enemiesThisWave = count;
      state.waveProgress = 0;

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (!gameStateRef.current || gameStateRef.current.gameOver) return;

          let type: Enemy['type'] = 'basic';
          const rand = Math.random();

          if (wave >= 3 && rand < 0.3) type = 'shooter';
          else if (wave >= 2 && rand < 0.5) type = 'fast';
          else if (wave >= 4 && rand < 0.6) type = 'tank';

          spawnEnemy(type, wave);
          state.waveProgress++;
        }, i * 500);
      }
    };

    // Create particles
    const createParticles = (pos: Vector2, color: string, count: number = 10) => {
      const state = gameStateRef.current!;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 2 + Math.random() * 3;
        state.particles.push({
          pos: { ...pos },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          radius: 2 + Math.random() * 3,
          life: 1,
          maxLife: 1,
          color,
        });
      }
    };

    // Spawn power-up
    const spawnPowerUp = (pos: Vector2) => {
      const state = gameStateRef.current!;
      if (Math.random() < 0.3) {
        const types: PowerUp['type'][] = ['health', 'damage', 'firerate', 'speed'];
        const colors = { health: '#44ff44', damage: '#ff4444', firerate: '#4444ff', speed: '#ffff44' };
        const type = types[Math.floor(Math.random() * types.length)];

        state.powerUps.push({
          pos: { ...pos },
          vel: { x: 0, y: 2 },
          radius: 10,
          type,
          color: colors[type],
        });
      }
    };

    // Game loop
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const state = gameStateRef.current;
      if (!state) return;

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (state.paused || state.gameOver) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Update player
      const player = state.player;
      player.vel.x = 0;
      player.vel.y = 0;

      if (state.keys.has('ArrowLeft') || state.keys.has('KeyA')) player.vel.x -= player.speed;
      if (state.keys.has('ArrowRight') || state.keys.has('KeyD')) player.vel.x += player.speed;
      if (state.keys.has('ArrowUp') || state.keys.has('KeyW')) player.vel.y -= player.speed;
      if (state.keys.has('ArrowDown') || state.keys.has('KeyS')) player.vel.y += player.speed;

      player.pos.x += player.vel.x;
      player.pos.y += player.vel.y;

      // Boundary check
      player.pos.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.pos.x));
      player.pos.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.pos.y));

      // Shooting
      if (state.keys.has('Space') && currentTime - player.lastFired > player.fireRate) {
        state.bullets.push({
          pos: { ...player.pos },
          vel: { x: 0, y: -10 },
          radius: 4,
          damage: player.damage,
          isPlayerBullet: true,
        });
        player.lastFired = currentTime;
      }

      if (player.invulnerable > 0) player.invulnerable -= deltaTime;

      // Update enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];

        // Basic AI - move toward player
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 100) {
          enemy.vel.x = (dx / dist) * enemy.speed * 0.3;
          enemy.vel.y = (dy / dist) * enemy.speed;
        } else {
          enemy.vel.x *= 0.95;
          enemy.vel.y = enemy.speed * 0.5;
        }

        enemy.pos.x += enemy.vel.x;
        enemy.pos.y += enemy.vel.y;

        // Shooter enemies fire bullets
        if (enemy.type === 'shooter' && currentTime - (enemy.lastFired || 0) > 1000) {
          const angle = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x);
          state.bullets.push({
            pos: { ...enemy.pos },
            vel: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 },
            radius: 5,
            damage: 5 + state.wave,
            isPlayerBullet: false,
          });
          enemy.lastFired = currentTime;
        }

        // Remove if off screen
        if (enemy.pos.y > canvas.height + 50) {
          state.enemies.splice(i, 1);
        }
      }

      // Update bullets
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        bullet.pos.x += bullet.vel.x;
        bullet.pos.y += bullet.vel.y;

        if (
          bullet.pos.x < 0 ||
          bullet.pos.x > canvas.width ||
          bullet.pos.y < 0 ||
          bullet.pos.y > canvas.height
        ) {
          state.bullets.splice(i, 1);
        }
      }

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const particle = state.particles[i];
        particle.pos.x += particle.vel.x;
        particle.pos.y += particle.vel.y;
        particle.life -= deltaTime / 1000;
        particle.vel.x *= 0.98;
        particle.vel.y *= 0.98;

        if (particle.life <= 0) {
          state.particles.splice(i, 1);
        }
      }

      // Update power-ups
      for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const powerUp = state.powerUps[i];
        powerUp.pos.y += powerUp.vel.y;

        if (powerUp.pos.y > canvas.height + 50) {
          state.powerUps.splice(i, 1);
        }
      }

      // Collision: bullets vs enemies
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        if (!bullet.isPlayerBullet) continue;

        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const enemy = state.enemies[j];
          const dx = bullet.pos.x - enemy.pos.x;
          const dy = bullet.pos.y - enemy.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < bullet.radius + enemy.radius) {
            enemy.health -= bullet.damage;
            state.bullets.splice(i, 1);
            createParticles(bullet.pos, enemy.color, 5);

            if (enemy.health <= 0) {
              state.score += Math.floor(10 * state.wave * (enemy.maxHealth / 20));
              state.enemiesKilled++;
              createParticles(enemy.pos, enemy.color, 15);
              spawnPowerUp(enemy.pos);
              state.enemies.splice(j, 1);
            }
            break;
          }
        }
      }

      // Collision: enemy bullets vs player
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        if (bullet.isPlayerBullet) continue;

        const dx = bullet.pos.x - player.pos.x;
        const dy = bullet.pos.y - player.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bullet.radius + player.radius && player.invulnerable <= 0) {
          player.health -= bullet.damage;
          player.invulnerable = 500;
          state.bullets.splice(i, 1);
          createParticles(bullet.pos, '#4444ff', 8);

          if (player.health <= 0) {
            state.gameOver = true;
            createParticles(player.pos, '#44ffff', 30);
          }
        }
      }

      // Collision: player vs enemies
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + enemy.radius && player.invulnerable <= 0) {
          player.health -= 10 + state.wave * 2;
          player.invulnerable = 1000;
          createParticles(enemy.pos, enemy.color, 10);
          state.enemies.splice(i, 1);

          if (player.health <= 0) {
            state.gameOver = true;
            createParticles(player.pos, '#44ffff', 30);
          }
        }
      }

      // Collision: player vs power-ups
      for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const powerUp = state.powerUps[i];
        const dx = player.pos.x - powerUp.pos.x;
        const dy = player.pos.y - powerUp.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + powerUp.radius) {
          createParticles(powerUp.pos, powerUp.color, 8);

          switch (powerUp.type) {
            case 'health':
              player.health = Math.min(player.maxHealth, player.health + 20);
              break;
            case 'damage':
              player.damage += 2;
              break;
            case 'firerate':
              player.fireRate = Math.max(50, player.fireRate - 15);
              break;
            case 'speed':
              player.speed = Math.min(8, player.speed + 0.3);
              break;
          }

          state.powerUps.splice(i, 1);
        }
      }

      // Wave management
      if (state.waveProgress >= state.enemiesThisWave && state.enemies.length === 0) {
        state.wave++;
        spawnWave(state.wave);
      }

      // Render
      ctx.fillStyle = '#000814';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars background
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 100; i++) {
        const x = (i * 137.5) % canvas.width;
        const y = ((i * 217.3 + currentTime * 0.05) % canvas.height);
        ctx.fillRect(x, y, 1, 1);
      }

      // Draw particles
      state.particles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(particle.pos.x, particle.pos.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw power-ups
      state.powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.pos.x, powerUp.pos.y, powerUp.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw bullets
      state.bullets.forEach(bullet => {
        ctx.fillStyle = bullet.isPlayerBullet ? '#00ffff' : '#ff00ff';
        ctx.beginPath();
        ctx.arc(bullet.pos.x, bullet.pos.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw enemies
      state.enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        const barWidth = enemy.radius * 2;
        const barHeight = 4;
        const healthPercent = enemy.health / enemy.maxHealth;

        ctx.fillStyle = '#333333';
        ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y - enemy.radius - 8, barWidth, barHeight);

        ctx.fillStyle = '#44ff44';
        ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y - enemy.radius - 8, barWidth * healthPercent, barHeight);
      });

      // Draw player
      if (!state.gameOver) {
        const alpha = player.invulnerable > 0 && Math.floor(currentTime / 100) % 2 === 0 ? 0.3 : 1;
        ctx.fillStyle = `rgba(68, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(player.pos.x, player.pos.y, player.radius, 0, Math.PI * 2);
        ctx.fill();

        // Player direction indicator
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(player.pos.x, player.pos.y - player.radius - 5);
        ctx.lineTo(player.pos.x - 5, player.pos.y - player.radius);
        ctx.lineTo(player.pos.x + 5, player.pos.y - player.radius);
        ctx.fill();
      }

      // UI
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`Score: ${state.score}`, 20, 30);
      ctx.fillText(`Wave: ${state.wave}`, 20, 60);
      ctx.fillText(`Enemies: ${state.enemies.length}`, 20, 90);

      // Health bar
      const barWidth = 200;
      const barHeight = 20;
      const healthPercent = player.health / player.maxHealth;

      ctx.fillStyle = '#333333';
      ctx.fillRect(20, canvas.height - 40, barWidth, barHeight);

      ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : healthPercent > 0.25 ? '#ffff44' : '#ff4444';
      ctx.fillRect(20, canvas.height - 40, barWidth * Math.max(0, healthPercent), barHeight);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, canvas.height - 40, barWidth, barHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`HP: ${Math.max(0, Math.floor(player.health))}/${player.maxHealth}`, 30, canvas.height - 23);

      // Stats
      ctx.font = '14px monospace';
      ctx.fillText(`DMG: ${player.damage.toFixed(0)}`, 240, canvas.height - 23);
      ctx.fillText(`SPD: ${player.speed.toFixed(1)}`, 330, canvas.height - 23);
      ctx.fillText(`RATE: ${(1000 / player.fireRate).toFixed(1)}/s`, 420, canvas.height - 23);

      // Game over
      if (state.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 60px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px monospace';
        ctx.fillText(`Final Score: ${state.score}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText(`Wave: ${state.wave}`, canvas.width / 2, canvas.height / 2 + 40);

        ctx.font = 'bold 24px monospace';
        ctx.fillText('Press SPACE to restart', canvas.width / 2, canvas.height / 2 + 100);

        ctx.textAlign = 'left';
      }

      // Paused
      if (state.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);

        ctx.font = '20px monospace';
        ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 50);

        ctx.textAlign = 'left';
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Start first wave
    spawnWave(1);

    // Start game loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {showUI && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontFamily: 'monospace',
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #44ffff',
        }}>
          <h1 style={{ fontSize: '48px', margin: '0 0 20px 0', color: '#44ffff' }}>SPACE ROGUELITE</h1>
          <div style={{ fontSize: '18px', marginBottom: '30px', lineHeight: '1.6' }}>
            <p><strong>CONTROLS:</strong></p>
            <p>WASD / Arrow Keys - Move</p>
            <p>SPACE - Shoot</p>
            <p>P - Pause</p>
            <br />
            <p><strong>POWER-UPS:</strong></p>
            <p style={{ color: '#44ff44' }}>Green - Health</p>
            <p style={{ color: '#ff4444' }}>Red - Damage</p>
            <p style={{ color: '#4444ff' }}>Blue - Fire Rate</p>
            <p style={{ color: '#ffff44' }}>Yellow - Speed</p>
          </div>
          <button
            onClick={() => setShowUI(false)}
            style={{
              fontSize: '24px',
              padding: '15px 40px',
              background: '#44ffff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#000',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#66ffff'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#44ffff'}
          >
            START GAME
          </button>
        </div>
      )}
    </div>
  );
}
