#import "ViewController.h"
#import <WebKit/WebKit.h>
#import "ZPSchemeHandler.h"

@interface ViewController () <WKUIDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property (strong, nonatomic) WKWebView *webView;
@end

@implementation ViewController

- (void)viewDidLoad {
  [super viewDidLoad];

  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  [config setURLSchemeHandler:[[ZPSchemeHandler alloc] init] forURLScheme:@"zp"];
  // pont JS -> natif : partage de fichiers, ouverture, sauvegarde de sécurité
  config.userContentController = [[WKUserContentController alloc] init];
  [config.userContentController addScriptMessageHandler:self name:@"zp"];

  self.webView = [[WKWebView alloc] initWithFrame:self.view.bounds configuration:config];
  self.webView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  self.webView.backgroundColor = [UIColor colorWithRed:0.980 green:0.968 blue:0.949 alpha:1];
  self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
  self.webView.UIDelegate = self;
  self.webView.navigationDelegate = self;
  [self.view addSubview:self.webView];

  NSURL *url = [NSURL URLWithString:@"zp://local/index.html"];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

/* ---- pont JS : {action: "partage"|"ouvrir"|"sauvegarde", nom, data(base64)} ---- */
- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
  if (![message.name isEqualToString:@"zp"]) return;
  NSData *brut = [(NSString *)message.body dataUsingEncoding:NSUTF8StringEncoding];
  if (!brut) return;
  NSDictionary *infos = [NSJSONSerialization JSONObjectWithData:brut options:0 error:nil];
  if (![infos isKindOfClass:[NSDictionary class]]) return;

  NSString *action = infos[@"action"] ?: @"";
  NSString *nom = infos[@"nom"] ?: @"document.pdf";
  nom = [nom componentsSeparatedByString:@"/"].lastObject;      // pas de dossier dans le nom
  nom = [nom componentsSeparatedByString:@"\\"].lastObject;
  NSData *contenu = [[NSData alloc] initWithBase64EncodedString:infos[@"data"] ?: @"" options:0];
  if (!contenu.length) return;

  // copie de sécurité permanente (Documents de l'app) — restaurée au démarrage si besoin
  if ([action isEqualToString:@"sauvegarde"]) {
    NSString *copie = [[NSHomeDirectory() stringByAppendingPathComponent:@"Documents"]
                          stringByAppendingPathComponent:@"zeropaperasse-donnees.json"];
    [contenu writeToFile:copie atomically:YES];
    return;
  }

  NSString *chemin = [NSTemporaryDirectory() stringByAppendingPathComponent:nom];
  [contenu writeToFile:chemin atomically:YES];
  UIActivityViewController *partage = [[UIActivityViewController alloc]
      initWithActivityItems:@[ [NSURL fileURLWithPath:chemin] ] applicationActivities:nil];
  [self presentViewController:partage animated:YES completion:NULL];
}

/* ---- mailto:, tel: -> apps système (WKWebView ne le fait pas tout seul) ---- */
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
  NSString *scheme = action.request.URL.scheme ?: @"";
  if ([scheme isEqualToString:@"mailto"] || [scheme isEqualToString:@"tel"]) {
    [[UIApplication sharedApplication] openURL:action.request.URL options:@{} completionHandler:nil];
    decisionHandler(WKNavigationActionPolicyCancel);
    return;
  }
  decisionHandler(WKNavigationActionPolicyAllow);
}

/* ---- affichage natif des alertes / confirmations JS (WKWebView ne les
   affiche pas tout seul : sans ça, confirm() renvoie silencieusement NON) ---- */
- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:message preferredStyle:UIAlertControllerStyleAlert];
  [alerte addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(); }]];
  [self presentViewController:alerte animated:YES completion:NULL];
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:message preferredStyle:UIAlertControllerStyleAlert];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Annuler" style:UIAlertActionStyleCancel
      handler:^(UIAlertAction *action) { completionHandler(NO); }]];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Confirmer" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(YES); }]];
  [self presentViewController:alerte animated:YES completion:NULL];
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt
    defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame
    completionHandler:(void (^)(NSString *result))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:prompt preferredStyle:UIAlertControllerStyleAlert];
  [alerte addTextFieldWithConfigurationHandler:^(UITextField *champ) { champ.text = defaultText; }];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Annuler" style:UIAlertActionStyleCancel
      handler:^(UIAlertAction *action) { completionHandler(nil); }]];
  [alerte addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(alerte.textFields.firstObject.text); }]];
  [self presentViewController:alerte animated:YES completion:NULL];
}

/* l'app est toujours en portrait, comme la PWA */
- (BOOL)shouldAutorotate { return NO; }
- (UIInterfaceOrientationMask)supportedInterfaceOrientations { return UIInterfaceOrientationMaskPortrait; }

@end
