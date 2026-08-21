import sys
import asyncio
import edge_tts
import os

async def text_to_speech(text, output_path, voice="id-ID-ArdiNeural"):
    """Convert text to speech using edge-tts"""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"OK:{output_path}")

if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "Halo, ini test suara."
    output = sys.argv[2] if len(sys.argv) > 2 else "output.ogg"
    voice = sys.argv[3] if len(sys.argv) > 3 else "id-ID-ArdiNeural"
    
    asyncio.run(text_to_speech(text, output, voice))
