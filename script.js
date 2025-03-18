document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const scene = document.getElementById('scene');
    const startButton = document.getElementById('start-button');
    const objectCountSlider = document.getElementById('object-count');
    const objectCountValue = document.getElementById('object-count-value');
    const physicsComplexitySlider = document.getElementById('physics-complexity');
    const physicsComplexityValue = document.getElementById('physics-complexity-value');
    const visualComplexitySlider = document.getElementById('visual-complexity');
    const visualComplexityValue = document.getElementById('visual-complexity-value');
    const fpsValue = document.getElementById('fps-value');
    const objectCountStat = document.getElementById('object-count-stat');
    const timeElapsed = document.getElementById('time-elapsed');
    const scoreValue = document.getElementById('score-value');
    const resultOverlay = document.getElementById('result-overlay');
    const finalScore = document.getElementById('final-score');
    const resultFps = document.getElementById('result-fps');
    const resultMinFps = document.getElementById('result-min-fps');
    const resultObjects = document.getElementById('result-objects');
    const resultDuration = document.getElementById('result-duration');
    const resultClose = document.getElementById('result-close');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Simulation variables
    let isRunning = false;
    let animationId = null;
    let startTime = 0;
    let objects = [];
    let frameCount = 0;
    let lastFrameTime = 0;
    let fps = 0;
    let fpsHistory = [];
    let lastFpsUpdateTime = 0;
    let score = 0;
    
    // Physics configuration
    const physicsConfig = {
      gravity: 0.3,        // Increased for more dynamic behavior
      damping: 0.98,
      friction: 0.97,      // Higher friction for floor contact
      minVelocity: 0.01,
      collisionDamping: 0.7,
      maximumVelocity: 15,
      turbulence: 0.01,
      floorY: window.innerHeight / 2,  // Floor position
      floorRestitution: 0.7            // How bouncy the floor is
    };
    
    // Container bounds
    const bounds = {
      minX: -window.innerWidth / 2,
      maxX: window.innerWidth / 2,
      minY: -window.innerHeight / 2,
      maxY: window.innerHeight / 2,
      minZ: -window.innerWidth / 2,
      maxZ: window.innerWidth / 2,
      width: window.innerWidth,
      height: window.innerHeight,
      depth: window.innerWidth
    };
    
    // Update slider value displays
    objectCountSlider.addEventListener('input', function() {
      objectCountValue.textContent = this.value;
    });
    
    physicsComplexitySlider.addEventListener('input', function() {
      physicsComplexityValue.textContent = this.value + '%';
    });
    
    visualComplexitySlider.addEventListener('input', function() {
      visualComplexityValue.textContent = this.value + '%';
    });
    
    // Start/Stop button click handler
    startButton.addEventListener('click', function() {
      if (isRunning) {
        stopSimulation();
      } else {
        startSimulation();
      }
    });
    
    // Close result overlay
    resultClose.addEventListener('click', function() {
      resultOverlay.classList.remove('active');
    });
    
    // Function to create a hexecontahedron object
    function createHexecontahedron(size, faceCount) {
      const container = document.createElement('div');
      container.className = 'shape-container';
      
      const hexecontahedron = document.createElement('div');
      hexecontahedron.className = 'hexecontahedron';
      
      // Create the faces
      for (let i = 0; i < faceCount; i++) {
        const face = document.createElement('div');
        face.className = 'hexecontahedron-face';
        
        // Use a combination of rotation angles to distribute faces evenly
        const longitude = (i % 10) * 36;  // 10 points around, each 36 degrees
        const latitude = Math.floor(i / 10) * 30 - 75; // 6 layers, each 30 degrees, offset to center
        
        // Adjust hue for a nice gradient of colors
        const hue = (i * 6) % 360;
        face.style.background = `linear-gradient(135deg, 
                                 hsla(${hue}, 100%, 70%, 0.6), 
                                 hsla(${hue + 40}, 100%, 50%, 0.6))`;
        
        // Apply transform to arrange faces in a spherical pattern
        face.style.transform = `rotateY(${longitude}deg) rotateX(${latitude}deg) translateZ(${size / 2}px)`;
        
        hexecontahedron.appendChild(face);
      }
      
      container.appendChild(hexecontahedron);
      return container;
    }
    
    // Create a physics object
    function createPhysicsObject(complexity) {
      // Determine size and face count based on complexity
      const size = 20 + Math.random() * 20 * (complexity / 100);
      const faceCount = Math.max(10, Math.floor(60 * (complexity / 100)));
      
      // Create visual element
      const element = createHexecontahedron(size, faceCount);
      scene.appendChild(element);
      
      // Position objects only within the visible screen area
      // Use a smaller area (0.5) to ensure objects are fully visible even with their size
      const position = {
        x: (Math.random() - 0.5) * bounds.width * 0.5, 
        y: bounds.minY + (Math.random() * bounds.height * 0.3), // Start from top third of screen
        z: (Math.random() - 0.5) * bounds.depth * 0.4  // Keep z-depth more conservative
      };
      
      // Random velocity - with slight downward bias
      const velocity = {
        x: (Math.random() - 0.5) * 3,
        y: Math.random() * 3,  // Initially moving downward (positive is down in our system)
        z: (Math.random() - 0.5) * 3
      };
      
      // Random rotation
      const rotation = {
        x: Math.random() * 360,
        y: Math.random() * 360,
        z: Math.random() * 360
      };
      
      // Random rotation velocity
      const rotationVel = {
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 3,
        z: (Math.random() - 0.5) * 3
      };
      
      // Object properties
      return {
        element,
        position,
        velocity,
        rotation,
        rotationVel,
        size,
        mass: size * size * size / 1000, // Mass proportional to volume
        restitution: 0.7 + Math.random() * 0.3, // Bounciness
        lastBounce: 0  // Track when last bounce occurred
      };
    }
    
    // Apply physics to an object
    function updatePhysics(obj, deltaTime, complexity) {
      // Scale delta time to avoid huge jumps
      const dt = Math.min(deltaTime, 33) / 16;
      
      // Apply gravity (positive y is down in our system)
      obj.velocity.y += physicsConfig.gravity * dt;
      
      // Apply turbulence based on complexity
      if (complexity > 20) {
        const turbulenceStrength = physicsConfig.turbulence * (complexity / 100);
        obj.velocity.x += (Math.random() - 0.5) * turbulenceStrength * dt;
        obj.velocity.y += (Math.random() - 0.5) * turbulenceStrength * dt;
        obj.velocity.z += (Math.random() - 0.5) * turbulenceStrength * dt;
      }
      
      // Apply damping
      obj.velocity.x *= Math.pow(physicsConfig.damping, dt);
      obj.velocity.y *= Math.pow(physicsConfig.damping, dt);
      obj.velocity.z *= Math.pow(physicsConfig.damping, dt);
      
      // Apply rotation
      obj.rotation.x += obj.rotationVel.x * dt;
      obj.rotation.y += obj.rotationVel.y * dt;
      obj.rotation.z += obj.rotationVel.z * dt;
      
      // Clamp velocities to prevent explosion
      const speedSquared = obj.velocity.x * obj.velocity.x + 
                           obj.velocity.y * obj.velocity.y + 
                           obj.velocity.z * obj.velocity.z;
                            
      if (speedSquared > physicsConfig.maximumVelocity * physicsConfig.maximumVelocity) {
        const factor = physicsConfig.maximumVelocity / Math.sqrt(speedSquared);
        obj.velocity.x *= factor;
        obj.velocity.y *= factor;
        obj.velocity.z *= factor;
      }
      
      // Update position
      obj.position.x += obj.velocity.x * dt;
      obj.position.y += obj.velocity.y * dt;
      obj.position.z += obj.velocity.z * dt;
      
      // Boundary collision checks
      
      // X bounds
      if (obj.position.x - obj.size/2 < bounds.minX) {
        obj.position.x = bounds.minX + obj.size/2;
        obj.velocity.x = Math.abs(obj.velocity.x) * obj.restitution;
        obj.rotationVel.z -= obj.velocity.y * 0.1 * dt; // Add spin when hitting wall
      } else if (obj.position.x + obj.size/2 > bounds.maxX) {
        obj.position.x = bounds.maxX - obj.size/2;
        obj.velocity.x = -Math.abs(obj.velocity.x) * obj.restitution;
        obj.rotationVel.z += obj.velocity.y * 0.1 * dt; // Add spin when hitting wall
      }
      
      // Floor collision (positive Y is down in our coordinate system)
      const currentTime = performance.now();
      if (obj.position.y + obj.size/2 > bounds.maxY) {
        obj.position.y = bounds.maxY - obj.size/2;
        
        // Only bounce if coming down with sufficient speed
        if (obj.velocity.y > 0.1) {
          // Record this bounce
          obj.lastBounce = currentTime;
          
          // Bounce with floor
          obj.velocity.y = -Math.abs(obj.velocity.y) * obj.restitution * physicsConfig.floorRestitution;
          
          // Add some spin based on horizontal velocity
          obj.rotationVel.x += obj.velocity.z * 0.2 * dt;
          obj.rotationVel.z -= obj.velocity.x * 0.2 * dt;
          
          // Apply friction to horizontal velocity when bouncing
          obj.velocity.x *= physicsConfig.friction;
          obj.velocity.z *= physicsConfig.friction;
        } else {
          // If very slow, stop vertical movement to rest on floor
          obj.velocity.y = 0;
          
          // Apply more friction when resting on floor
          obj.velocity.x *= physicsConfig.friction * 0.95;
          obj.velocity.z *= physicsConfig.friction * 0.95;
          
          // Slow down rotation when at rest
          obj.rotationVel.x *= 0.95;
          obj.rotationVel.y *= 0.98;
          obj.rotationVel.z *= 0.95;
        }
      }
      
      // Ceiling collision
      if (obj.position.y - obj.size/2 < bounds.minY) {
        obj.position.y = bounds.minY + obj.size/2;
        obj.velocity.y = Math.abs(obj.velocity.y) * obj.restitution;
      }
      
      // Z bounds
      if (obj.position.z - obj.size/2 < bounds.minZ) {
        obj.position.z = bounds.minZ + obj.size/2;
        obj.velocity.z = Math.abs(obj.velocity.z) * obj.restitution;
        obj.rotationVel.x += obj.velocity.y * 0.1 * dt; // Add spin when hitting wall
      } else if (obj.position.z + obj.size/2 > bounds.maxZ) {
        obj.position.z = bounds.maxZ - obj.size/2;
        obj.velocity.z = -Math.abs(obj.velocity.z) * obj.restitution;
        obj.rotationVel.x -= obj.velocity.y * 0.1 * dt; // Add spin when hitting wall
      }
      
      // Object collision checks
      if (complexity > 40 && objects.length < 500) {
        for (let i = 0; i < objects.length; i++) {
          const other = objects[i];
          if (other === obj) continue;
          
          // Calculate distance between objects
          const dx = other.position.x - obj.position.x;
          const dy = other.position.y - obj.position.y;
          const dz = other.position.z - obj.position.z;
          const distSquared = dx*dx + dy*dy + dz*dz;
          
          // Minimum distance for collision
          const minDist = (obj.size + other.size) / 2;
          
          if (distSquared < minDist * minDist) {
            // Collision detected!
            // Calculate collision normal
            const dist = Math.sqrt(distSquared);
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            
            // Move objects apart to prevent overlap
            const overlap = minDist - dist;
            const totalMass = obj.mass + other.mass;
            const ratio1 = other.mass / totalMass;
            const ratio2 = obj.mass / totalMass;
            
            obj.position.x -= nx * overlap * ratio1;
            obj.position.y -= ny * overlap * ratio1;
            obj.position.z -= nz * overlap * ratio1;
            
            other.position.x += nx * overlap * ratio2;
            other.position.y += ny * overlap * ratio2;
            other.position.z += nz * overlap * ratio2;
            
            // Calculate relative velocity
            const vx = obj.velocity.x - other.velocity.x;
            const vy = obj.velocity.y - other.velocity.y;
            const vz = obj.velocity.z - other.velocity.z;
            
            // Calculate velocity along normal
            const vDotN = vx * nx + vy * ny + vz * nz;
            
            // Only apply impulse if objects are moving toward each other
            if (vDotN < 0) {
              // Calculate impulse
              const elasticity = (obj.restitution + other.restitution) / 2;
              const impulse = (-(1 + elasticity) * vDotN) / totalMass;
              
              // Apply impulse to velocities
              obj.velocity.x += impulse * other.mass * nx * physicsConfig.collisionDamping;
              obj.velocity.y += impulse * other.mass * ny * physicsConfig.collisionDamping;
              obj.velocity.z += impulse * other.mass * nz * physicsConfig.collisionDamping;
              
              other.velocity.x -= impulse * obj.mass * nx * physicsConfig.collisionDamping;
              other.velocity.y -= impulse * obj.mass * ny * physicsConfig.collisionDamping;
              other.velocity.z -= impulse * obj.mass * nz * physicsConfig.collisionDamping;
              
              // Apply angular momentum (simplified)
              obj.rotationVel.x += (ny * vz - nz * vy) * 0.05;
              obj.rotationVel.y += (nz * vx - nx * vz) * 0.05;
              obj.rotationVel.z += (nx * vy - ny * vx) * 0.05;
              
              other.rotationVel.x -= (ny * vz - nz * vy) * 0.05;
              other.rotationVel.y -= (nz * vx - nx * vz) * 0.05;
              other.rotationVel.z -= (nx * vy - ny * vx) * 0.05;
            }
          }
        }
      }
      
      // Apply transform to visual element with center offset
      const offsetX = window.innerWidth / 2;
      const offsetY = window.innerHeight / 2;
      obj.element.style.transform = `
        translate3d(${obj.position.x + offsetX}px, ${obj.position.y + offsetY}px, ${obj.position.z}px)
        rotateX(${obj.rotation.x}deg)
        rotateY(${obj.rotation.y}deg)
        rotateZ(${obj.rotation.z}deg)
      `;
    }
    
    // Handle window resizing
    function updateBounds() {
      bounds.width = window.innerWidth;
      bounds.height = window.innerHeight;
      bounds.depth = window.innerWidth;
      
      bounds.minX = -bounds.width / 2;
      bounds.maxX = bounds.width / 2;
      bounds.minY = -bounds.height / 2;
      bounds.maxY = bounds.height / 2;
      bounds.minZ = -bounds.depth / 2;
      bounds.maxZ = bounds.depth / 2;
      
      // Update floor position
      physicsConfig.floorY = bounds.maxY;
    }
    
    window.addEventListener('resize', updateBounds);
    
    // Animation loop
    function animate(timestamp) {
      // First frame timestamp
      if (!lastFrameTime) {
        lastFrameTime = timestamp;
        requestAnimationFrame(animate);
        return;
      }
      
      // Calculate delta time
      const deltaTime = timestamp - lastFrameTime;
      lastFrameTime = timestamp;
      
      // Calculate elapsed time
      const elapsedTime = timestamp - startTime;
      
      // Update FPS counter
      frameCount++;
      if (timestamp - lastFpsUpdateTime >= 500) { // Update every 500ms
        fps = Math.round(frameCount / ((timestamp - lastFpsUpdateTime) / 1000));
        frameCount = 0;
        lastFpsUpdateTime = timestamp;
        
        // Store in history for averaging
        fpsHistory.push(fps);
        if (fpsHistory.length > 20) {
          fpsHistory.shift();
        }
        
        // Update FPS display
        fpsValue.textContent = fps;
        if (fps >= 50) {
          fpsValue.className = 'stats-value fps-good';
        } else if (fps >= 30) {
          fpsValue.className = 'stats-value fps-medium';
        } else {
          fpsValue.className = 'stats-value fps-bad';
        }
        
        // Calculate score based on FPS and complexity
        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        const objectCount = parseInt(objectCountSlider.value);
        const physicsComplexity = parseInt(physicsComplexitySlider.value);
        const visualComplexity = parseInt(visualComplexitySlider.value);
        
        // Score calculation:
        // - Base on average FPS (max 60)
        // - Scale by complexity factors
        score = Math.min(100, Math.round(
          (avgFps / 60) * 100 * 
          (1 + objectCount / 2000) * 
          (1 + physicsComplexity / 200) * 
          (1 + visualComplexity / 200)
        ));
        
        scoreValue.textContent = score;
        
        // Update time display
        const seconds = Math.floor(elapsedTime / 1000);
        timeElapsed.textContent = `${seconds}s`;
        
        // Check if we should end the test (30 seconds)
        if (seconds >= 30 && isRunning) {
          stopSimulation(true);
        }
      }
      
      // Get current complexity settings
      const physicsComplexity = parseInt(physicsComplexitySlider.value);
      
      // Update physics for each object
      for (let i = 0; i < objects.length; i++) {
        updatePhysics(objects[i], deltaTime, physicsComplexity);
      }
      
      if (isRunning) {
        animationId = requestAnimationFrame(animate);
      }
    }
    
    // Start simulation
    function startSimulation() {
      if (isRunning) return;
      
      // Reset variables
      isRunning = true;
      startTime = performance.now();
      lastFrameTime = 0;
      frameCount = 0;
      lastFpsUpdateTime = 0;
      fpsHistory = [];
      
      // Update button
      startButton.textContent = 'STOP TEST';
      startButton.classList.add('running');
      
      // Clear any existing objects
      while (objects.length > 0) {
        const obj = objects.pop();
        scene.removeChild(obj.element);
      }
      
      // Show loading indicator
      loadingIndicator.classList.add('visible');
      
      // Get settings from controls
      const objectCount = parseInt(objectCountSlider.value);
      const visualComplexity = parseInt(visualComplexitySlider.value);
      
      // Create objects in batches to prevent UI freeze
      let created = 0;
      
      function createBatch() {
        const batchSize = 20;
        const start = created;
        const end = Math.min(created + batchSize, objectCount);
        
        for (let i = start; i < end; i++) {
          objects.push(createPhysicsObject(visualComplexity));
        }
        
        created = end;
        objectCountStat.textContent = created;
        
        if (created < objectCount) {
          // Schedule next batch
          setTimeout(createBatch, 0);
        } else {
          // All objects created, start animation
          loadingIndicator.classList.remove('visible');
          animationId = requestAnimationFrame(animate);
        }
      }
      
      // Start creating objects
      setTimeout(createBatch, 10);
    }
    
    // Stop simulation
    function stopSimulation(showResults = false) {
      if (!isRunning) return;
      
      isRunning = false;
      
      // Cancel animation
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      
      // Update button
      startButton.textContent = 'START STRESS TEST';
      startButton.classList.remove('running');
      
      // Calculate final results
      const elapsedTime = performance.now() - startTime;
      const seconds = Math.floor(elapsedTime / 1000);
      
      // Calculate average FPS
      const avgFps = fpsHistory.length > 0 ? 
        (fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length).toFixed(1) : 
        0;
      
      // Calculate min FPS
      const minFps = fpsHistory.length > 0 ? 
        Math.min(...fpsHistory).toFixed(1) : 
        0;
      
      // Update result overlay
      if (showResults) {
        finalScore.textContent = score;
        resultFps.textContent = avgFps;
        resultMinFps.textContent = minFps;
        resultObjects.textContent = objects.length;
        resultDuration.textContent = `${seconds}s`;
        
        // Show results
        resultOverlay.classList.add('active');
      }
    }
    
    // Initialize
    updateBounds();
  });