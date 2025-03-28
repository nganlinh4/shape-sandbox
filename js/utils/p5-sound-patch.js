/**
 * p5-sound-patch.js
 * Monkey patches for p5.sound library to fix common initialization issues
 */

(function() {
    // Wait for p5 to be defined
    function checkAndPatchP5Sound() {
        if (!window.p5) {
            // If p5 isn't loaded yet, try again soon
            setTimeout(checkAndPatchP5Sound, 100);
            return;
        }

        console.log('Patching p5.sound to prevent common errors...');
        
        // 1. Fix the addModule error
        // This error happens because p5.sound tries to use addModule on an undefined object
        const p5Prototype = window.p5.prototype;
        
        // Create a safer version of the registerMethod function
        if (p5Prototype && p5Prototype.registerMethod) {
            const originalRegisterMethod = p5Prototype.registerMethod;
            
            p5Prototype.registerMethod = function(name, method) {
                try {
                    return originalRegisterMethod.call(this, name, method);
                } catch (error) {
                    // If we hit the addModule error, log it but don't throw
                    if (error instanceof TypeError && 
                        error.message.includes('Cannot read properties') &&
                        error.message.includes('addModule')) {
                        console.warn('Caught p5.sound addModule error (safely handled)');
                        
                        // Optionally try to fix what's missing
                        if (name === 'init' && method) {
                            // Create a safer version of the method
                            const safeMethod = function() {
                                try {
                                    return method.apply(this, arguments);
                                } catch (innerError) {
                                    console.warn('Error in p5 init method:', innerError.message);
                                }
                            };
                            
                            // Try again with safe method
                            try {
                                return originalRegisterMethod.call(this, name, safeMethod);
                            } catch (retryError) {
                                console.warn('Still could not register init method safely');
                            }
                        }
                    } else {
                        // For other errors, we might want to still log them
                        console.warn('Error in registerMethod:', error);
                    }
                }
            };
        }
        
        // 2. Make sound initialization more robust
        if (p5Prototype && p5Prototype.getAudioContext) {
            const originalGetAudioContext = p5Prototype.getAudioContext;
            
            p5Prototype.getAudioContext = function() {
                try {
                    return originalGetAudioContext.call(this);
                } catch (error) {
                    console.warn('Error getting audio context, creating fallback:', error.message);
                    
                    // Create a fallback audio context if needed
                    if (!this._patchedAudioContext) {
                        try {
                            const AudioContext = window.AudioContext || window.webkitAudioContext;
                            if (AudioContext) {
                                this._patchedAudioContext = new AudioContext();
                            }
                        } catch (audioError) {
                            console.warn('Could not create fallback audio context');
                            return null;
                        }
                    }
                    return this._patchedAudioContext;
                }
            };
        }
        
        // 3. Apply safety to userStartAudio
        if (p5.prototype && p5.prototype.userStartAudio) {
            const originalUserStartAudio = p5.prototype.userStartAudio;
            
            p5.prototype.userStartAudio = function() {
                try {
                    // Try to call original method
                    return originalUserStartAudio.apply(this, arguments);
                } catch (error) {
                    console.warn('Error in userStartAudio, using fallback:', error.message);
                    
                    // Create a simple fallback that returns a resolved promise
                    return new Promise((resolve) => {
                        const audioContext = this.getAudioContext();
                        if (audioContext && audioContext.state !== 'running') {
                            audioContext.resume().then(resolve).catch(resolve);
                        } else {
                            resolve();
                        }
                    });
                }
            };
        }
        
        console.log('p5.sound patching complete');
    }
    
    // Start checking as soon as this script loads
    checkAndPatchP5Sound();
    
    // Also add a global error handler specifically for the addModule error
    window.addEventListener('error', function(event) {
        if (event && event.error && 
            event.error.message && 
            event.error.message.includes('addModule') &&
            event.filename && 
            event.filename.includes('p5.sound')) {
            
            console.warn('Intercepted p5.sound addModule error');
            // Prevent default browser error handling
            event.preventDefault();
            
            // Let the system know we've handled this specific error
            window._p5SoundAddModuleErrorHandled = true;
            
            return false;
        }
    }, true);
})();