// =====================================================================
// EX-06b  DomeAudienceInput.cs   --   Unity
// =====================================================================
// The cheapest real interaction a dome audience can have: their own voice.
// Reads the default microphone and exposes a smoothed level plus a low-band
// energy value, so a full room of people can push your scene around.
//
// Add it to one GameObject. Read DomeAudienceInput.Level from anywhere.
//
// Note for the show: a microphone in a dome will also hear the dome's own
// sound system. If your piece has a soundtrack, aim the mic at the seats,
// or gate it, or you will build a feedback loop and it will be very loud.
// =====================================================================
using UnityEngine;

[AddComponentMenu("Dome/Dome Audience Input")]
public class DomeAudienceInput : MonoBehaviour
{
    public static float Level { get; private set; }   // 0..1, smoothed
    public static float Bass  { get; private set; }   // 0..1, low band

    [Range(0.01f, 1f)] public float smoothing = 0.2f;
    [Min(0.1f)] public float gain = 12f;

    AudioClip _clip;
    string _device;
    readonly float[] _samples = new float[1024];
    readonly float[] _spectrum = new float[512];
    AudioSource _src;

    void Start()
    {
        if (Microphone.devices.Length == 0)
        {
            Debug.LogWarning("DomeAudienceInput: no microphone found.");
            enabled = false;
            return;
        }
        _device = Microphone.devices[0];
        _clip = Microphone.Start(_device, true, 1, AudioSettings.outputSampleRate);

        _src = gameObject.AddComponent<AudioSource>();
        _src.clip = _clip;
        _src.loop = true;
        _src.mute = true;                       // never play the mic back
        while (Microphone.GetPosition(_device) <= 0) { }
        _src.Play();
    }

    void Update()
    {
        if (_src == null) return;

        _src.GetOutputData(_samples, 0);
        float sum = 0f;
        for (int i = 0; i < _samples.Length; i++) sum += _samples[i] * _samples[i];
        float rms = Mathf.Sqrt(sum / _samples.Length);
        Level = Mathf.Lerp(Level, Mathf.Clamp01(rms * gain), smoothing);

        _src.GetSpectrumData(_spectrum, 0, FFTWindow.Blackman);
        float low = 0f;
        for (int i = 0; i < 16; i++) low += _spectrum[i];
        Bass = Mathf.Lerp(Bass, Mathf.Clamp01(low * gain * 4f), smoothing * 1.6f);
    }

    void OnDisable()
    {
        if (_device != null && Microphone.IsRecording(_device)) Microphone.End(_device);
    }
}
