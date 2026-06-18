# Raylib TUI Primitives

## Overview
Raylib is a simple and easy-to-use game programming library written in C. It provides a complete suite of primitives for 2D and 3D graphics, input handling, audio, and more.

## Core Architecture

### 1. Rendering System

**Immediate Mode Rendering:**
```c
// Basic render loop
InitWindow(800, 600, "My Game");
SetTargetFPS(60);

while (!WindowShouldClose()) {
    BeginDrawing();
    ClearBackground(RAYWHITE);
    
    // Draw your primitives here
    DrawRectangle(100, 100, 50, 50, RED);
    DrawText("Hello World!", 100, 100, 20, BLACK);
    
    EndDrawing();
}
```

**2D Primitives (rshapes.c):**
```c
// Lines
DrawLine(int x1, int y1, int x2, int y2, Color color);
DrawLineEx(Vector2 start, Vector2 end, float thick, Color color);
DrawLineStrip(Vector2* points, int num_points, Color color);
DrawLines(Vector2* points, int num_points, Color color);
DrawDashedLine(int x1, int y1, int x2, int y2, int gapSize, Color color);

// Basic shapes
DrawRectangle(int x, int y, int width, int height, Color color);
DrawRectangleV(Vector2 position, Vector2 size, Color color);
DrawRectangleRec(Rectangle rec, Color color);
DrawRectanglePro(Rectangle rec, Vector2 origin, float rotation, Color color);
DrawRectangleGradientH(int x, int y, int width, int height, Color left, Color right);
DrawRectangleGradientV(int x, int y, int width, int height, Color top, Color bottom);
DrawRectangleGradientQuad(Rectangle rec, Color topLeft, Color topRight, Color bottomRight, Color bottomLeft);

// Circles
DrawCircle(int centerX, int centerY, float radius, Color color);
DrawCircleSector(Vector2 center, float radius, float startAngle, float endAngle, int segments, Color color);
DrawCircleSectorLines(Vector2 center, float radius, float startAngle, float endAngle, int segments, Color color);
DrawCircleGradient(int centerX, int centerY, float radius, Color center, Color edge);
DrawCircleLines(int centerX, int centerY, float radius, Color color);

// Ellipses
DrawEllipse(int centerX, int centerY, float radiusH, float radiusV, Color color);
DrawEllipseLines(int centerX, int centerY, float radiusH, float radiusV, Color color);

// Rings
DrawRing(Vector2 center, float innerRadius, float outerRadius, float startAngle, float endAngle, int segments, Color color);
DrawRingLines(Vector2 center, float innerRadius, float outerRadius, float startAngle, float endAngle, int segments, Color color);

// Polygons
DrawPoly(Vector2 center, int sides, float radius, float rotation, Color color);
DrawPolyLines(Vector2 center, int sides, float radius, float rotation, Color color);
DrawPolyLinesEx(Vector2 center, int sides, float radius, float thickness, Color color);

// Special shapes
DrawTriangle(Vector2 v1, Vector2 v2, Vector2 v3, Color color);
DrawTriangleLines(Vector2 v1, Vector2 v2, Vector2 v3, Color color);
DrawTriangleFan(Vector2* vertices, int count, Color color);
DrawTriangleStrip(Vector2* vertices, int count, Color color);
DrawSpirograph(Vector2 center, float outerRadius, float innerRadius, int outerSegments, int innerSegments, float rotationSpeed, Color color);
DrawStar(Vector2 center, int outerPoints, int innerPoints, float outerRadius, float innerRadius, float rotation, Color color);

// Curves
DrawBezierCubic(Vector2 start, Vector2 control1, Vector2 control2, Vector2 end, Color color);
DrawBezierQuadratic(Vector2 start, Vector2 control, Vector2 end, Color color);
DrawSplineLinear(Vector2* points, int pointCount, float thickness, Color color);
DrawSplineBasis(Vector2* points, int pointCount, float thickness, Color color);
DrawSplineCatmullRom(Vector2* points, int pointCount, float thickness, Color color);
DrawSplineBezierCubic(Vector2* points, int pointCount, float thickness, Color color);
DrawSplineBezierQuadratic(Vector2* points, int pointCount, float thickness, Color color);

// Pixels and utilities
DrawPixel(int posX, int posY, Color color);
DrawPixelV(Vector2 position, Color color);
DrawVline(int posX, int startY, int endY, Color color);
DrawHline(int startY, int posX1, int posX2, Color color);
```

**3D Primitives (rmodels.c):**
```c
// Solid shapes
DrawCube(Vector3 position, float width, float height, float length, Color color);
DrawCubeWires(Vector3 position, float width, float height, float length, Color color);
DrawCubeWiresExtended(Vector3 position, float width, float height, float length, float thick, Color color);
DrawSphere(Vector3 centerPosition, float radius, Color color);
DrawSphereWires(Vector3 centerPosition, float radius, int rings, int slices, Color color);
DrawCylinder(Vector3 position, float radiusTop, float radiusBottom, float height, Color color);
DrawCylinderWires(Vector3 position, float radiusTop, float radiusBottom, float height, int slices, Color color);
DrawConeCylinder(Vector3 position, float radius, float height, Color color);
DrawConeCylinderWires(Vector3 position, float radius, float height, int slices, Color color);
DrawTorus(Vector3 position, float radius, float thickness, int radSeg, int sides, Color color);
DrawTorusWires(Vector3 position, float radius, float thickness, int radSeg, int sides, Color color);
DrawKnot(Vector3 position, float radius, float thickness, int radSeg, int sides, Color color);
DrawKnotWires(Vector3 position, float radius, float thickness, int radSeg, int sides, Color color);
DrawPlane(Vector3 centerPosition, Vector2 size, Color color);
DrawGrid(int slices, float spacing, Color color);

// Mesh utilities
Mesh MeshFromPolygons(Polygons* polygons);
void MeshDraw(Mesh mesh, const Material* material);
void MeshDrawEx(Mesh mesh, const Material* material, Matrix transform);
void MeshUnref(Mesh* mesh);
void MeshUpdateBound(Mesh* mesh, bool force);
```

**Materials and Shaders:**
```c
// Material system
Material LoadMaterial(const char* filename);
Material LoadMaterialDefault(void);
void SetMaterialTexture(Material* material, int mapType, Texture2D texture);
void SetMaterialTextureRec(Material* material, int mapType, Texture2D texture, Rectangle sourceRec);
void SetMaterialShader(Material* material, Shader shader);
void SetMaterialTextureMapSize(Material* material, int mapType, int width, int height);
void DrawModel(Model model, Vector3 position, float scale, Color tint);
void DrawModelEx(Model model, Vector3 position, Vector3 rotationAxis, float rotationAngle, Vector3 scale, Color tint);
void DrawModelWires(Model model, Vector3 position, float scale, Color tint);
void DrawModelWiresEx(Model model, Vector3 position, Vector3 rotationAxis, float rotationAngle, Vector3 scale, Color tint);
void DrawBoundingBox(BoundingBox box, Color color);
void DrawBillboard(Camera camera, Texture2D texture, Vector3 position, float size, Color tint);
void DrawBillboardRec(Camera camera, Texture2D texture, Rectangle source, Vector3 position, Vector2 size, Color tint);
void DrawBillboardPro(Camera camera, Texture2D texture, Rectangle source, Vector3 position, Vector3 up, float size, Color tint);

// Shader system
Shader LoadShader(const char* vertexFile, const char* fragmentFile);
Shader LoadShaderFromMemory(const char* vertexSource, const char* fragmentSource);
bool IsShaderValid(Shader shader);
int GetShaderLocation(Shader shader, const char* uniformName);
int GetShaderLocationAttrib(Shader shader, const char* attribName);
void SetShaderValue(Shader shader, int locIndex, const void* value, int uniformType);
void SetShaderValueV(Shader shader, int locIndex, const void* value, int count, int uniformType);
void SetShaderValueMatrix(Shader shader, int locIndex, Matrix mat);
void SetShaderValueTexture(Shader shader, int locIndex, Texture2D texture);
void UnloadShader(Shader shader);

// Drawing modes
void BeginShaderMode(Shader shader);
void EndShaderMode();
void BeginBlendMode(int mode);
void EndBlendMode();
void BeginScissorMode(int x, int y, int width, int height);
void EndScissorMode();
```

### 2. Input Handling

**Keyboard Input:**
```c
bool IsKeyDown(int key);
bool IsKeyPressed(int key);
bool IsKeyReleased(int key);
bool IsKeyUp(int key);
int GetKeyPressed();
int GetCharPressed();
void SetExitKey(int key);
```

**Mouse Input:**
```c
bool IsMouseButtonPressed(int button);
bool IsMouseButtonDown(int button);
bool IsMouseButtonReleased(int button);
bool IsMouseButtonUp(int button);
int GetMouseX();
int GetMouseY();
Vector2 GetMousePosition();
Vector2 GetMouseDelta();
void SetMousePosition(int x, int y);
void SetMouseOffset(int offsetX, int offsetY);
void SetMouseScale(float scaleX, float scaleY);
void DisableMouseCursor();
void EnableMouseCursor();
bool IsMouseCursorVisible();
```

**Touch Input:**
```c
int GetTouchX();
int GetTouchY();
Vector2 GetTouchPosition(int index);
int GetTouchPointId(int index);
int GetTouchPointCount();
```

**Gamepad Input:**
```c
bool IsGamepadAvailable(int gamepad);
bool IsGamepadNameUnknown(int gamepad);
const char* GetGamepadName(int gamepad);
bool IsGamepadButtonPressed(int gamepad, int button);
bool IsGamepadButtonDown(int gamepad, int button);
bool IsGamepadButtonReleased(int gamepad, int button);
bool IsGamepadButtonUp(int gamepad, int button);
int GetGamepadButtonPressed();
int GetGamepadAxisCount(int gamepad);
float GetGamepadAxisMovement(int gamepad, int axis);
void SetGamepadMappings(const char* mappings);
```

**Gestures:**
```c
void SetConfigFlags(unsigned int flags);
void InitGestures(unsigned int flags);
bool IsGestureDetected(unsigned int gesture);
unsigned int GetGestureDetected();
float GetGestureHoldDuration();
Vector2 GetGestureDragVector();
float GetGestureDragRadius();
float GetGestureRotateAngle();
float GetGesturePinchDelta();
```

### 3. Window Management

```c
void InitWindow(int width, int height, const char* title);
void CloseWindow();
bool WindowShouldClose();
bool IsWindowFullscreen();
bool IsWindowFocused();
bool IsWindowResized();
bool IsWindowHidden();
bool IsWindowMinimized();
bool IsWindowMaximized();
bool IsWindowUnfocused();
void UnfocusWindow();
void FocusWindow();
void SetWindowPosition(int x, int y);
void SetWindowMonitor(int monitor);
void SetWindowMinSize(int width, int height);
void SetWindowMaxSize(int width, int height);
void SetWindowSize(int width, int height);
void SetWindowOpacity(float opacity);
void SetWindowFocused();
const char* GetWindowTitle();
void SetWindowTitle(const char* title);
void SetWindowIcon(Image image);
void SetWindowIcons(Image* images, int count);
void SetWindowGamma(float r, float g, float b);
Image GetWindowIcon();
int GetScreenWidth();
int GetScreenHeight();
int GetRenderWidth();
int GetRenderHeight();
void SetTargetFPS(int fps);
float GetFrameTime();
double GetTime();
int GetFPS();
void ClearBackground(Color color);
void BeginDrawing();
void EndDrawing();
```

### 4. Camera System

**2D Camera:**
```c
typedef struct Camera2D {
    Vector2 offset;
    Vector2 target;
    float rotation;
    float zoom;
} Camera2D;

void BeginMode2D(Camera2D camera);
void EndMode2D();
```

**3D Camera:**
```c
typedef struct Camera {
    Vector3 position;
    Vector3 target;
    Vector3 up;
    float fovy;
    int projection; // CAMERA_PERSPECTIVE or CAMERA_ORTHOGRAPHIC
} Camera;

typedef struct Camera3D {
    Vector3 position;
    Vector3 target;
    Vector3 up;
    float fovy;
    int projection;
    float nearPlane;
    float farPlane;
} Camera3D;

void BeginMode3D(Camera camera);
void EndMode3D();
void SetCameraZoom(Camera* camera, float zoom);
void SetCameraTarget(Camera* camera, Vector3 target);
void SetCameraSource(Camera* camera, Vector3 source);
void SetCameraProjection(Camera* camera, int mode);
void SetCameraPanControl(Camera* camera, int key);
void SetCameraZoomControl(Camera* camera, int key);
void SetCameraRotateControl(Camera* camera, int key);
```

### 5. Texture and Image System

**Image Loading:**
```c
Image LoadImage(const char* filename);
Image LoadImageRaw(const char* filename, int width, int height, int format, int headerSize);
Image LoadImageAnim(const char* filename, int* frames);
Image LoadImageGifAnim(const char* filename, int* frames);
Image LoadImageFromMemory(const char* filetype, const unsigned char* fileData, int dataSize);
Image LoadImageFromStream(const char* filetype, Stream* stream);
Image LoadImageDefault();
void UnloadImage(Image image);
bool ExportImage(Image image, const char* filename);
bool ExportImageAsCode(Image image, const char* filename);
Image ImageCopy(Image image);
Image ImageFromImage(Image image, Rectangle rec);
Image ImageFromChannel(Image image, int selectedChannel);
Image ImageText(const char* text);
Image TextImageEx(const char* text, int fontSize, const char* font, Color color);
Image ImageText(const char* text, int fontSize, Color color);
Image ImageTextEx(const char* text, Font font, int fontSize, float spacing, Color tint);
Image ImageClearBackground(Image image, Color color);
Image ImageDrawPixel(Image image, Vector2 position, Color color);
Image ImageDrawPixelV(Image image, Vector2 position, Color color);
Image ImageDrawLine(Image image, Vector2 start, Vector2 end, Color color);
Image ImageDrawLineV(Image image, Vector2 start, Vector2 end, Color color);
Image ImageDrawLineEx(Image image, Vector2 start, Vector2 end, int thick, Color color);
Image ImageDrawCircle(Image image, Vector2 center, int radius, Color color);
Image ImageDrawCircleV(Image image, Vector2 center, int radius, Color color);
Image ImageDrawCircleLines(Image image, Vector2 center, int radius, Color color);
Image ImageDrawEllipse(Image image, Vector2 center, float radiusH, float radiusV, Color color);
Image ImageDrawEllipseLines(Image image, Vector2 center, float radiusH, float radiusV, Color color);
Image ImageDrawRectangle(Image image, Rectangle rec, Color color);
Image ImageDrawRectangleV(Image image, Vector2 position, Vector2 size, Color color);
Image ImageDrawRectangleRec(Image image, Rectangle rec, Color color);
Image ImageDrawRectangleLines(Image image, Rectangle rec, int thick, Color color);
Image ImageDrawRectangleLinesEx(Image image, Rectangle rec, int thick, Color color);
Image ImageDrawRectangleRounded(Image image, Rectangle rec, float roundness, int segments, Color color);
Image ImageDrawRectangleRoundedLines(Image image, Rectangle rec, float roundness, int segments, int thick, Color color);
Image ImageDrawTriangle(Image image, Vector2 v1, Vector2 v2, Vector2 v3, Color color);
Image ImageDrawTriangleLines(Image image, Vector2 v1, Vector2 v2, Vector2 v3, Color color);
Image ImageDrawPoly(Image image, Vector2* points, int numPoints, int roundness, int segments, Color color);
Image ImageDrawPolyLines(Image image, Vector2* points, int numPoints, int roundness, int segments, Color color);
Image ImageDrawPolyLinesEx(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawSplineLinear(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawSplineBasis(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawSplineCatmullRom(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawSplineBezierCubic(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawSplineBezierQuadratic(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDraw(Image image, Image src, Rectangle srcRec, Rectangle dstRec, Color tint);
Image ImageDrawEx(Image image, Image src, Rectangle srcRec, Rectangle dstRec, Color tint, float zoom);
Image ImageDrawLines(Image image, Vector2* points, int numPoints, int thick, Color color);
Image ImageDrawTriangleFan(Image image, Vector2* points, int numPoints, Color color);
Image ImageDrawTriangleStrip(Image image, Vector2* points, int numPoints, Color color);
Image ImageRescale(Image image, int newWidth, int newHeight);
Image ImageResize(Image image, int newWidth, int newHeight);
Image ImageResizeNN(Image image, int newWidth, int newHeight);
Image ImageCrop(Image image, Rectangle crop);
Image ImageAlphaCrop(Image image, float threshold);
Image ImageAlphaMask(Image image, Image alphaMask);
Image ImageAlphaClear(Image image, Color color, float threshold);
Image ImageAlphaBlend(Image image, Image dst, Color tint);
Image ImageBlurGaussian(Image image, int blurSize);
Image ImageKawaseBlur(Image image, int blurSize, int iterations);
Image ImageDither(Image image, int rBpp, int gBpp, int bBpp, int aBpp);
Image ImageFlipVertical(Image image);
Image ImageFlipHorizontal(Image image);
Image ImageRotate(Image image, int degrees);
Image ImageRotateCW(Image image);
Image ImageRotateCCW(Image image);
Image ImageTint(Image image, Color color);
Image ImageBrightness(Image image, float brightness);
Image ImageContrast(Image image, float contrast);
Image ImageGamma(Image image, float gamma);
Image ImageColorInvert(Image image);
Image ImageColorGrayscale(Image image);
Image ImageColorReplace(Image image, Color color, Color replace);
Color* LoadImageColors(Image image);
Palette* LoadImagePalette(Image image, int maxColors);
Image ImageFromColors(Image* colors, int width, int height);
bool SaveImage(Image image, const char* filename);
int GetImageAlphaBorder(Image image, float threshold);
void ImageToPVR(Image image, int quality, int maxMipmaps, int maxTextureSize, int channels);
Rectangle GetImageClip(Image image);
void SetImageClip(Image* image, Rectangle clip);
Rectangle GetImagePad(Image image);
void SetImagePad(Image* image, Rectangle pad);
```

**Texture System:**
```c
Texture2D LoadTexture(const char* filename);
Texture2D LoadTextureFromImage(Image image);
TextureCubemap LoadCubemap(Image image);
TextureCubemap LoadCubemapFromImage(Image image);
Texture2D LoadTextureDefault();
void UnloadTexture(Texture2D texture);
bool UpdateTexture(Texture2D texture, const void* pixels);
void UpdateTextureRec(Texture2D texture, Rectangle rec, const void* pixels);
bool GetTextureData(Texture2D texture, void** pixels);
Image ImageFromTexture(Texture2D texture);
void DrawTexture(Texture2D texture, int posX, int posY, Color tint);
void DrawTextureV(Texture2D texture, Vector2 position, Color tint);
void DrawTextureEx(Texture2D texture, Vector2 position, float rotation, float scale, Color tint);
void DrawTextureRec(Texture2D texture, Rectangle source, Vector2 position, Color tint);
void DrawTextureQuad(Texture2D texture, Vector2 tiling, Vector2 offset, Vector2 size, Color tint);
void DrawTextureTiled(Texture2D texture, Rectangle source, Rectangle dest, Vector2 origin, float rotation, float scale, Color tint);
void DrawTexturePro(Texture2D texture, Rectangle source, Rectangle dest, Vector2 origin, float rotation, Color tint);
void DrawTextureNPatch(Texture2D texture, NPatchInfo patchInfo, Rectangle dest, Vector2 origin, float rotation, Color tint);
Rectangle GetTextureBounds(Texture2D texture);
void SetTextureFilter(Texture2D texture, int filter);
void SetTextureWrap(Texture2D texture, int wrap);
```

### 6. Text Rendering

```c
Font GetFontDefault();
void SetTextFont(Font font);
void SetTextSize(int fontSize);
void SetTextLineSpacing(int spacing);
void SetTextAlignment(int alignment);
void SetTextLetterSpacing(int spacing);
void SetTextWordSpacing(int spacing);
void SetTextOffset(int offsetX, int offsetY);
int MeasureText(const char* text, int fontSize);
Vector2 MeasureTextEx(Font font, const char* text, float fontSize, float spacing);
int GetGlyphIndex(Font font, int character);
Font LoadFont(const char* filename);
Font LoadFontEx(const char* filename, int fontSize, int* codepoints, int codepointCount);
Font LoadFontFromImage(Image image, const Color* key, int keySize);
Font LoadFontFromMemory(const char* filetype, const unsigned char* fileData, int dataSize, int fontSize, int* codepoints, int codepointCount);
Image GenFontAtlas(const GlyphInfo* glyphs, int glyphCount, int* recs, int recsSize, int fontSize, int padding, int packMethod);
void BuildFontData(Font* font);
void GenGlyphsImage(Font font, GlyphInfo* glyphs, int* glyphCount, int maxGlyphCount);
bool SaveFontAsImage(Font font, const char* filename);
bool SaveFont(FileStream* stream, Font font);
void UnloadFont(Font font);
Image ImageText(const char* text);
Image TextImageEx(const char* text, int fontSize, const char* font, Color color);
Image ImageText(const char* text, int fontSize, Color color);
Image ImageTextEx(const char* text, Font font, int fontSize, float spacing, Color tint);
void DrawText(const char* text, int posX, int posY, int fontSize, Color color);
void DrawTextEx(GraphicsDevice* device, Font font, const char* text, Vector2 position, float fontSize, float spacing, Color tint);
void DrawTextRec(GraphicsDevice* device, Font font, const char* text, Rectangle rec, float fontSize, float spacing, TextAlignment hAlignment, TextAlignment vAlignment, Color tint);
void DrawTextRecEx(GraphicsDevice* device, Font font, const char* text, Rectangle rec, float fontSize, float spacing, TextAlignment hAlignment, TextAlignment vAlignment, bool wordWrap, Color tint);
void DrawTextCodepoint(GraphicsDevice* device, Font font, int codepoint, Vector2 position, float fontSize, Color tint);
void DrawTextCodepoints(GraphicsDevice* device, Font font, const int* codepoints, int codepointCount, Vector2 position, float fontSize, float spacing, Color tint);
void DrawTextCodepointEx(GraphicsDevice* device, Font font, int codepoint, Vector2 position, float fontSize, float rotation, Color tint);
```

### 7. Math Utilities

```c
// Vector operations
Vector2 Vector2Add(Vector2 left, Vector2 right);
Vector2 Vector2Subtract(Vector2 left, Vector2 right);
Vector2 Vector2Multiply(Vector2 left, Vector2 right);
Vector2 Vector2Divide(Vector2 left, Vector2 right);
float Vector2Length(Vector2 vector);
float Vector2LengthSqr(Vector2 vector);
float Vector2Distance(Vector2 v1, Vector2 v2);
float Vector2DistanceSqr(Vector2 v1, Vector2 v2);
Vector2 Vector2Normalize(Vector2 vector);
Vector2 Vector2NormalizeUnsafe(Vector2 vector);
Vector2 Vector2Inverse(Vector2 vector);
Vector2 Vector2Clamp(Vector2 vector, Vector2 min, Vector2 max);
Vector2 Vector2ClampValue(float value, float min, float max);
Vector2 Vector2Lerp(Vector2 start, Vector2 end, float amount);
Vector2 Vector2Transform(Vector2 vector, Matrix transform);
Vector2 Vector2Rotate(Vector2 vector, float angle);
Vector2 Vector2MoveTowards(Vector2 current, Vector2 target, float maxDistance);
float Vector2Angle(Vector2 start, Vector2 end);
Vector2 Vector2CrossProduct(Vector2 a, Vector2 b);
Vector2 Vector2DotProduct(Vector2 a, Vector2 b);
Vector2 Vector2Reflect(Vector2 vector, Vector2 normal);
Vector2 Vector2Mirror(Vector2 vector, Vector2 normal);
Vector2 Vector2Floor(Vector2 vector);
Vector2 Vector2Ceil(Vector2 vector);
Vector2 Vector2FloorValue(float value);
Vector2 Vector2CeilValue(float value);
Vector2 Vector2LerpValue(float value, float min, float max);
Vector2 Vector2Sqrt(Vector2 vector);
Vector2 Vector2Abs(Vector2 vector);

// Matrix operations
Matrix MatrixAdd(Matrix left, Matrix right);
Matrix MatrixSubtract(Matrix left, Matrix right);
Matrix MatrixMultiply(Matrix left, Matrix right);
Matrix MatrixScale(float scaleX, float scaleY, float scaleZ);
Matrix MatrixRotate(float angle, Vector3 axis);
Matrix MatrixRotateX(float angle);
Matrix MatrixRotateY(float angle);
Matrix MatrixRotateZ(float angle);
Matrix MatrixTranslate(float x, float y, float z);
Matrix MatrixFrustum(double left, double right, double bottom, double top, double nearPlane, double farPlane);
Matrix MatrixOrtho(double left, double right, double bottom, double top, double nearPlane, double farPlane);
Matrix MatrixLookAt(Vector3 eye, Vector3 target, Vector3 up);
Matrix MatrixIdentity();
Matrix MatrixInvert(Matrix m);
Matrix MatrixTranspose(Matrix m);
Matrix MatrixPerspectiveFov(float fovY, float width, float height, float nearPlane, float farPlane);
Matrix MatrixRotationXYZ(float x, float y, float z);
Matrix MatrixRotationAxisAngle(Vector3 axis, float angle);

// Quaternion operations
Quaternion QuaternionAdd(Quaternion q1, Quaternion q2);
Quaternion QuaternionSubtract(Quaternion q1, Quaternion q2);
Quaternion QuaternionMultiply(Quaternion q1, Quaternion q2);
Quaternion QuaternionScale(Quaternion q, float scalar);
Quaternion QuaternionDivide(Quaternion q, float divisor);
float QuaternionLength(Quaternion q);
Quaternion QuaternionNormalize(Quaternion q);
Quaternion QuaternionInvert(Quaternion q);
Quaternion QuaternionLerp(Quaternion q1, Quaternion q2, float t);
Quaternion QuaternionSlerp(Quaternion q1, Quaternion q2, float t);
Quaternion QuaternionCubicSlerp(Quaternion q1, Quaternion q2, Quaternion q3, Quaternion q4, float t);
Quaternion QuaternionFromAxisAngle(Vector3 axis, float angle);
Quaternion QuaternionFromEuler(float pitch, float yaw, float roll);
Quaternion QuaternionFromMatrix(Matrix m);
Quaternion QuaternionToAxisAngle(Quaternion q, Vector3* outAxis, float* outAngle);
float QuaternionAngle(Quaternion q);
Vector3 QuaternionToEuler(Quaternion q);
```

### 8. Audio System

```c
void InitAudioDevice();
void CloseAudioDevice();
bool IsAudioDeviceReady();
void SetMasterVolume(float volume);
float GetMasterVolume();

// Sound
Sound LoadSound(const char* filename);
Sound LoadSoundFromMemory(const char* filetype, const unsigned char* fileData, int dataSize);
Sound LoadSoundDefault();
void UpdateSound(Sound sound, const void* data, int samplesCount);
void UnloadSound(Sound sound);
bool PlaySound(Sound sound);
void StopSound(Sound sound);
void PauseSound(Sound sound);
void ResumeSound(Sound sound);
bool IsSoundPlaying(Sound sound);
bool SetSoundVolume(Sound sound, float volume);
bool SetSoundPitch(Sound sound, float pitch);
Vector3 GetSoundPosition(Sound sound);

// Music
Music LoadMusicStream(const char* filename);
Music LoadMusicStreamFromMemory(const char* filetype, const unsigned char* data, int dataSize);
Music LoadMusicStreamDefault();
void UpdateMusicStream(Music music, const void* data, int samplesCount);
void UnloadMusicStream(Music music);
void PlayMusicStream(Music music);
bool IsMusicPlaying(Music music);
void PauseMusicStream(Music music);
void ResumeMusicStream(Music music);
void StopMusicStream(Music music);
void SetMusicVolume(Music music, float volume);
void SetMusicPitch(Music music, float pitch);
float GetMusicTimePlayed(Music music);
float GetMusicTimeTotal(Music music);
void SeekMusicStream(Music music, float position);
void SetMusicLoopCount(Music music, int count);
bool IsMusicLooping(Music music);
Vector3 GetMusicPosition(Music music);

// Wave
Wave LoadWave(const char* filename);
Wave LoadWaveFromMemory(const char* filetype, const unsigned char* fileData, int dataSize);
Wave LoadWaveDefault();
Wave LoadWaveFromImage(Image image);
void SaveWave(Wave wave, const char* filename);
void SaveWaveAsCode(Wave wave, const char* filename);
void UnloadWave(Wave wave);
Wave WaveCopy(Wave wave);
Wave WaveCrop(Wave wave, int initSample, int finalSample);
Wave WaveFormat(Wave wave, int sampleRate, int sampleSize, int channels);
Wave WaveNormalize(Wave wave);
Wave WaveReverse(Wave wave);
Wave WaveTrim(Wave wave, int trim);
float* WaveGetData(Wave wave);
int WaveGetSampleCount(Wave wave);

// Synthesis
Wave GenWaveSine(int sampleRate, int samplesCount);
Wave GenWaveSquare(int sampleRate, int samplesCount);
Wave GenWaveSaw(int sampleRate, int samplesCount);
Wave GenWaveTriangle(int sampleRate, int samplesCount);
Wave GenWaveWhiteNoise(int sampleRate, int samplesCount);
Wave GenWavePinkNoise(int sampleRate, int samplesCount);
Wave GenWaveBrownNoise(int sampleRate, int samplesCount);
```

### 9. File System

```c
bool FileExists(const char* fileName);
bool DirectoryExists(const char* dirPath);
bool IsFileExtension(const char* fileName, const char* ext);
int GetFileExtension(const char* fileName);
int GetFileName(const char* filePath);
int GetFileNameWithoutExt(const char* filePath);
int GetDirectory(const char* filePath);
int GetParentDir(const char* filePath);
int GetWorkingDirectory();
int GetResourcesPath();
void ChangeDirectory(const char* dir);
bool LoadFileData(const char* fileName, unsigned char** data);
void UnloadFileData(unsigned char* data);
bool SaveFileData(const char* fileName, void* data, int dataSize);
bool LoadFileText(const char* fileName, char** text);
void UnloadFileText(char* text);
bool SaveFileText(const char* fileName, const char* text);
FileStream OpenFile(const char* fileName, const char* mode);
FILE* GetFileHandle(const char* fileName);
FileStream OpenFileCustom(const char* fileName, const char* mode, int *fileSize);
int WriteFile(TextFile* file, void* data, int size);
int ReadFile(TextFile* file, void* data, int size);
int ReadFileChar(TextFile* file);
int WriteFileChar(TextFile* file, char c);
bool IsFileText(const char* fileName);
int ReadFileLines(const char* fileName, char** lines, int* count);
void UnloadFileLines(char** lines);
```

### 10. Utility Functions

```c
void EnableEventWaiting();
void DisableEventWaiting();
bool IsEventWaiting();
int GetTouchPointCount();
Vector2 GetTouchPosition(int index);
int GetTouchPointId(int index);
void SetConfigFlags(unsigned int flags);
void ShowCursor();
void HideCursor();
bool IsCursorVisible();
void ClearDroppedFiles();
char** GetDroppedFiles(int* count);
int GetClipboardText();
void SetClipboardText(const char* text);
long GetEnvironmentVariable(const char* name);
void SetEnvironmentVariable(const char* name, const char* value);
```

## Key Design Patterns

1. **Immediate Mode**: All rendering happens immediately in the draw loop
2. **Stateless**: No persistent state between frames
3. **Zero Dependencies**: Everything is self-contained
4. **Hardware Acceleration**: OpenGL for 2D/3D rendering
5. **Simple API**: Consistent naming and parameter order
6. **Cross-Platform**: Works on Windows, Linux, macOS, web, mobile
7. **Begin/End Pattern**: For modes that change rendering state
8. **Vector2/3/4**: Consistent math types throughout
9. **Color**: Single color type used everywhere
10. **Font/Texture**: Consistent loading and unloading

## Performance Considerations

- **Batching**: Combine draw calls when possible
- **Texture Caching**: Reuse textures instead of reloading
- **Object Pooling**: For frequently created/destroyed objects
- **LOD**: Level of detail for 3D models
- **Culling**: Don't render what's not visible
- **Delta Time**: Use for frame-independent movement
- **Target FPS**: Set appropriate frame rate
- **VSync**: Enable for smooth rendering
- **GPU Memory**: Manage texture and buffer sizes
- **Compression**: Use compressed textures when possible

This architecture provides a complete, self-contained solution for 2D and 3D game development with excellent performance and ease of use.
